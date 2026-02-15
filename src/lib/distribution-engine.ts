import prisma from './prisma';
import { pusherServer, CHANNELS, EVENTS } from './pusher';
import { Prisma, PenjokiStatus, OrderStatus, DistributionStatus, DistributionStrategy } from '@prisma/client';

// ============================================
// ORDER DISTRIBUTION ENGINE
// Core logic for automatically distributing 
// orders to available penjoki workers
// ============================================

interface DistributionResult {
  success: boolean;
  message: string;
  penjokiId?: string;
  distributionId?: string;
}

/**
 * Main entry point: Start distributing an order to available penjoki
 */
export async function startDistribution(orderId: string): Promise<DistributionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { distributions: true },
  });

  if (!order) {
    return { success: false, message: 'Order not found' };
  }

  if (order.status !== 'WAITING' && order.status !== 'SEARCHING') {
    return { success: false, message: `Order already ${order.status.toLowerCase()}` };
  }

  // Update order status to SEARCHING
  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SEARCHING },
  });

  // Notify admin about distribution start
  await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
    orderId,
    status: 'SEARCHING',
    message: `Mencari penjoki untuk order ${order.orderNumber}...`,
  });

  // Find next available penjoki
  return await distributeToNextPenjoki(orderId);
}

/**
 * Find and send order to the next available penjoki
 */
export async function distributeToNextPenjoki(orderId: string): Promise<DistributionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { distributions: true },
  });

  if (!order) {
    return { success: false, message: 'Order not found' };
  }

  // Check max attempts
  if (order.distributionAttempts >= order.maxAttempts) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.WAITING },
    });

    await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
      orderId,
      status: 'EXHAUSTED',
      message: `Tidak ada penjoki tersedia untuk order ${order.orderNumber}. Perlu assign manual.`,
    });

    return { success: false, message: 'All distribution attempts exhausted' };
  }

  // Get IDs of penjoki who already received this order
  const excludedPenjokiIds = order.distributions.map(d => d.penjokiId);

  // Find next penjoki based on strategy
  const nextPenjoki = await findNextPenjoki(
    order.distributionStrategy,
    excludedPenjokiIds,
    order.serviceType
  );

  if (!nextPenjoki) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.WAITING },
    });

    await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
      orderId,
      status: 'NO_PENJOKI',
      message: `Tidak ada penjoki online untuk order ${order.orderNumber}`,
    });

    return { success: false, message: 'No available penjoki found' };
  }

  // Create distribution record
  const distribution = await prisma.orderDistribution.create({
    data: {
      orderId,
      penjokiId: nextPenjoki.id,
      status: DistributionStatus.SENT,
    },
  });

  // Increment attempts
  await prisma.order.update({
    where: { id: orderId },
    data: { distributionAttempts: { increment: 1 } },
  });

  // Send real-time notification to penjoki
  await pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_OFFER, {
    distributionId: distribution.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    penjokiId: nextPenjoki.id,
    serviceType: order.serviceType,
    description: order.description,
    price: order.price,
    commission: order.price * nextPenjoki.commissionRate,
    deadline: order.deadline,
    customerName: order.customerName,
    responseTimeout: order.responseTimeout,
    timestamp: new Date().toISOString(),
  });

  // Notify admin
  await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
    orderId,
    penjokiId: nextPenjoki.id,
    penjokiName: nextPenjoki.name,
    status: 'SENT',
    distributionId: distribution.id,
    message: `Order ${order.orderNumber} dikirim ke ${nextPenjoki.name}`,
  });

  // Schedule timeout check
  scheduleTimeout(distribution.id, orderId, nextPenjoki.id, order.responseTimeout);

  return {
    success: true,
    message: `Order sent to ${nextPenjoki.name}`,
    penjokiId: nextPenjoki.id,
    distributionId: distribution.id,
  };
}

/**
 * Find next available penjoki based on distribution strategy
 */
async function findNextPenjoki(
  strategy: DistributionStrategy,
  excludeIds: string[],
  serviceType?: string
) {
  const baseWhere: Prisma.PenjokiWhereInput = {
    status: { in: [PenjokiStatus.ONLINE, PenjokiStatus.AVAILABLE] },
    isActive: true,
    isSuspended: false,
    id: { notIn: excludeIds },
  };

  // If service type matches specialization, prefer those penjoki
  let orderBy: Prisma.PenjokiOrderByWithRelationInput;

  switch (strategy) {
    case DistributionStrategy.RATING:
      orderBy = { rating: 'desc' };
      break;
    case DistributionStrategy.WORKLOAD:
      orderBy = { totalOrder: 'asc' };
      break;
    case DistributionStrategy.LEVEL:
      orderBy = { level: 'desc' };
      break;
    case DistributionStrategy.RANDOM:
    default:
      orderBy = { lastOnline: 'desc' };
      break;
  }

  // First try to find specialized penjoki
  if (serviceType) {
    const specializedPenjoki = await prisma.penjoki.findFirst({
      where: {
        ...baseWhere,
        specialization: { has: serviceType },
      },
      orderBy,
    });

    if (specializedPenjoki) return specializedPenjoki;
  }

  // Then find any available penjoki
  const penjoki = await prisma.penjoki.findFirst({
    where: baseWhere,
    orderBy,
  });

  return penjoki;
}

/**
 * Handle penjoki accepting an order
 */
export async function acceptOrder(
  distributionId: string,
  penjokiId: string
): Promise<DistributionResult> {
  const distribution = await prisma.orderDistribution.findUnique({
    where: { id: distributionId },
    include: { order: true, penjoki: true },
  });

  if (!distribution) {
    return { success: false, message: 'Distribution not found' };
  }

  if (distribution.penjokiId !== penjokiId) {
    return { success: false, message: 'Unauthorized' };
  }

  if (distribution.status !== DistributionStatus.SENT) {
    return { success: false, message: 'Distribution already responded' };
  }

  // Check if order is still available
  if (distribution.order.status !== 'SEARCHING') {
    return { success: false, message: 'Order sudah tidak tersedia' };
  }

  const now = new Date();
  const responseTime = Math.floor((now.getTime() - distribution.sentAt.getTime()) / 1000);

  // Update distribution
  await prisma.orderDistribution.update({
    where: { id: distributionId },
    data: {
      status: DistributionStatus.ACCEPTED,
      respondedAt: now,
      responseTime,
    },
  });

  // Update order
  const commission = distribution.order.price * distribution.penjoki.commissionRate;
  await prisma.order.update({
    where: { id: distribution.orderId },
    data: {
      status: OrderStatus.ACCEPTED,
      penjokiId,
      assignedAt: now,
      commission,
    },
  });

  // Update penjoki status
  await prisma.penjoki.update({
    where: { id: penjokiId },
    data: {
      status: PenjokiStatus.BUSY,
      totalOrder: { increment: 1 },
    },
  });

  // Cancel other pending distributions for this order
  await prisma.orderDistribution.updateMany({
    where: {
      orderId: distribution.orderId,
      id: { not: distributionId },
      status: DistributionStatus.SENT,
    },
    data: { status: DistributionStatus.TIMEOUT },
  });

  // Notify all parties
  await Promise.all([
    pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_ACCEPTED, {
      orderId: distribution.orderId,
      orderNumber: distribution.order.orderNumber,
      penjokiId,
      penjokiName: distribution.penjoki.name,
      distributionId,
    }),
    pusherServer.trigger(CHANNELS.ADMIN, EVENTS.ORDER_ACCEPTED, {
      orderId: distribution.orderId,
      orderNumber: distribution.order.orderNumber,
      penjokiId,
      penjokiName: distribution.penjoki.name,
      message: `Order ${distribution.order.orderNumber} diterima oleh ${distribution.penjoki.name}`,
    }),
  ]);

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: 'ORDER_ACCEPTED',
      entity: 'Order',
      entityId: distribution.orderId,
      details: `Order ${distribution.order.orderNumber} diterima oleh ${distribution.penjoki.name} (${responseTime}s)`,
      userId: distribution.penjoki.userId,
    },
  });

  return {
    success: true,
    message: `Order berhasil diterima`,
    penjokiId,
    distributionId,
  };
}

/**
 * Handle penjoki rejecting an order
 */
export async function rejectOrder(
  distributionId: string,
  penjokiId: string,
  reason?: string
): Promise<DistributionResult> {
  const distribution = await prisma.orderDistribution.findUnique({
    where: { id: distributionId },
    include: { order: true, penjoki: true },
  });

  if (!distribution) {
    return { success: false, message: 'Distribution not found' };
  }

  if (distribution.penjokiId !== penjokiId) {
    return { success: false, message: 'Unauthorized' };
  }

  if (distribution.status !== DistributionStatus.SENT) {
    return { success: false, message: 'Distribution already responded' };
  }

  const now = new Date();
  const responseTime = Math.floor((now.getTime() - distribution.sentAt.getTime()) / 1000);

  // Update distribution
  await prisma.orderDistribution.update({
    where: { id: distributionId },
    data: {
      status: DistributionStatus.REJECTED,
      respondedAt: now,
      responseTime,
      reason: reason || 'Ditolak oleh penjoki',
    },
  });

  // Update penjoki rejected count
  await prisma.penjoki.update({
    where: { id: penjokiId },
    data: { rejectedOrder: { increment: 1 } },
  });

  // Check auto-suspend (if rejected too many times)
  const penjoki = await prisma.penjoki.findUnique({ where: { id: penjokiId } });
  if (penjoki && penjoki.rejectedOrder > 0 && penjoki.rejectedOrder % 10 === 0) {
    await prisma.penjoki.update({
      where: { id: penjokiId },
      data: {
        isSuspended: true,
        suspendReason: `Auto-suspend: ${penjoki.rejectedOrder} order ditolak`,
        suspendUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }

  // Notify
  await Promise.all([
    pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_REJECTED, {
      orderId: distribution.orderId,
      orderNumber: distribution.order.orderNumber,
      penjokiId,
      penjokiName: distribution.penjoki.name,
      reason,
      distributionId,
    }),
    pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
      orderId: distribution.orderId,
      penjokiId,
      penjokiName: distribution.penjoki.name,
      status: 'REJECTED',
      reason,
      message: `${distribution.penjoki.name} menolak order ${distribution.order.orderNumber}`,
    }),
  ]);

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: 'ORDER_REJECTED',
      entity: 'Order',
      entityId: distribution.orderId,
      details: `Order ${distribution.order.orderNumber} ditolak oleh ${distribution.penjoki.name}. Alasan: ${reason || 'Tidak ada'}`,
      userId: distribution.penjoki.userId,
    },
  });

  // Distribute to next penjoki
  return await distributeToNextPenjoki(distribution.orderId);
}

/**
 * Handle distribution timeout
 */
export async function handleTimeout(
  distributionId: string,
  orderId: string,
  penjokiId: string
): Promise<DistributionResult> {
  const distribution = await prisma.orderDistribution.findUnique({
    where: { id: distributionId },
    include: { order: true, penjoki: true },
  });

  if (!distribution || distribution.status !== DistributionStatus.SENT) {
    return { success: false, message: 'Distribution not pending' };
  }

  // Update as timeout
  await prisma.orderDistribution.update({
    where: { id: distributionId },
    data: {
      status: DistributionStatus.TIMEOUT,
      respondedAt: new Date(),
    },
  });

  // Notify
  await Promise.all([
    pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_TIMEOUT, {
      orderId,
      penjokiId,
      distributionId,
    }),
    pusherServer.trigger(CHANNELS.ADMIN, EVENTS.DISTRIBUTION_UPDATE, {
      orderId,
      penjokiId,
      penjokiName: distribution.penjoki.name,
      status: 'TIMEOUT',
      message: `${distribution.penjoki.name} tidak merespon order ${distribution.order.orderNumber}`,
    }),
  ]);

  // Distribute to next penjoki
  return await distributeToNextPenjoki(orderId);
}

/**
 * Schedule a timeout check for a distribution
 * In serverless environment, we use a delayed API call approach
 */
function scheduleTimeout(
  distributionId: string,
  orderId: string,
  penjokiId: string,
  timeoutSeconds: number
) {
  // In a serverless environment, we trigger timeouts via client-side
  // countdown that calls the timeout API endpoint
  // The actual timeout is managed by the client and the API validates
  // if the distribution is still pending
  
  // For production, you could use:
  // 1. Vercel Cron Jobs
  // 2. Upstash QStash (delayed messages)
  // 3. Client-side setTimeout that calls the timeout API
  
  console.log(`[Distribution] Timeout scheduled: ${distributionId} in ${timeoutSeconds}s`);
}

/**
 * Generate unique order number
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DF${year}${month}${day}-${random}`;
}

/**
 * Complete an order
 */
export async function completeOrder(orderId: string, penjokiId: string): Promise<DistributionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { penjoki: true },
  });

  if (!order) return { success: false, message: 'Order not found' };
  if (order.penjokiId !== penjokiId) return { success: false, message: 'Unauthorized' };
  if (order.status !== 'PROCESSING' && order.status !== 'ACCEPTED') {
    return { success: false, message: 'Order cannot be completed' };
  }

  const now = new Date();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      completedAt: now,
    },
  });

  // Update penjoki stats
  await prisma.penjoki.update({
    where: { id: penjokiId },
    data: {
      status: PenjokiStatus.AVAILABLE,
      completedOrder: { increment: 1 },
      balance: { increment: order.commission },
      totalEarnings: { increment: order.commission },
    },
  });

  await Promise.all([
    pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_COMPLETED, {
      orderId,
      orderNumber: order.orderNumber,
      penjokiId,
    }),
    pusherServer.trigger(CHANNELS.ADMIN, EVENTS.ORDER_COMPLETED, {
      orderId,
      orderNumber: order.orderNumber,
      penjokiId,
      penjokiName: order.penjoki?.name,
      message: `Order ${order.orderNumber} telah selesai!`,
    }),
  ]);

  return { success: true, message: 'Order completed' };
}
