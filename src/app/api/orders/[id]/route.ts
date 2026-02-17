import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { startDistribution, completeOrder } from '@/lib/distribution-engine';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// GET - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        penjoki: { select: { id: true, name: true, email: true, rating: true, phone: true } },
        distributions: {
          include: {
            penjoki: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH - Update order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...updateData } = body;

    // Handle special actions
    if (action === 'redistribute') {
      // Reset distribution attempts dan hapus old distributions untuk mulai fresh
      await prisma.order.update({
        where: { id },
        data: {
          status: 'WAITING',
          distributionAttempts: 0,
          penjokiId: null,
          assignedAt: null,
        },
      });

      // Hapus semua distribusi lama agar penjoki bisa ditawari lagi
      await prisma.orderDistribution.deleteMany({
        where: { orderId: id },
      });

      const result = await startDistribution(id);
      return NextResponse.json(result);
    }

    if (action === 'start-processing') {
      const order = await prisma.order.update({
        where: { id },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      try {
        await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.ORDER_STATUS_CHANGED, {
          orderId: id,
          status: 'PROCESSING',
          message: `Order ${order.orderNumber} mulai diproses`,
        });
      } catch (pusherError) {
        console.error('Pusher broadcast error (non-fatal):', pusherError);
      }

      return NextResponse.json({ success: true, order });
    }

    if (action === 'complete') {
      if (!user.penjokiId && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const penjokiId = user.penjokiId || order.penjokiId;
      if (!penjokiId) {
        return NextResponse.json({ error: 'No penjoki assigned' }, { status: 400 });
      }

      const result = await completeOrder(id, penjokiId);
      return NextResponse.json(result);
    }

    if (action === 'assign-manual') {
      const { penjokiId } = updateData;
      if (!penjokiId) {
        return NextResponse.json({ error: 'penjokiId required' }, { status: 400 });
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          penjokiId,
          assignedAt: new Date(),
        },
        include: { penjoki: true },
      });

      await prisma.penjoki.update({
        where: { id: penjokiId },
        data: { status: 'BUSY', totalOrder: { increment: 1 } },
      });

      try {
        await pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.ORDER_ASSIGNED, {
          orderId: id,
          orderNumber: order.orderNumber,
          penjokiId,
        });
      } catch (pusherError) {
        console.error('Pusher broadcast error (non-fatal):', pusherError);
      }

      return NextResponse.json({ success: true, order });
    }

    // Generic update (admin only)
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
