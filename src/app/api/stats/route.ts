import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET - Dashboard statistics
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [
      totalOrders,
      waitingOrders,
      searchingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalPenjoki,
      onlinePenjoki,
      busyPenjoki,
      totalDistributions,
      acceptedDistributions,
      rejectedDistributions,
      timeoutDistributions,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'WAITING' } }),
      prisma.order.count({ where: { status: 'SEARCHING' } }),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.penjoki.count({ where: { isActive: true } }),
      prisma.penjoki.count({ where: { status: { in: ['ONLINE', 'AVAILABLE'] } } }),
      prisma.penjoki.count({ where: { status: 'BUSY' } }),
      prisma.orderDistribution.count(),
      prisma.orderDistribution.count({ where: { status: 'ACCEPTED' } }),
      prisma.orderDistribution.count({ where: { status: 'REJECTED' } }),
      prisma.orderDistribution.count({ where: { status: 'TIMEOUT' } }),
    ]);

    // Top penjoki by rating
    const topPenjoki = await prisma.penjoki.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        rating: true,
        totalOrder: true,
        completedOrder: true,
        rejectedOrder: true,
        level: true,
        status: true,
        totalEarnings: true,
      },
    });

    // Recent activity
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Revenue stats
    const revenueResult = await prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { price: true, commission: true },
    });

    const acceptanceRate = totalDistributions > 0
      ? Math.round((acceptedDistributions / totalDistributions) * 100)
      : 0;

    return NextResponse.json({
      orders: {
        total: totalOrders,
        waiting: waitingOrders,
        searching: searchingOrders,
        processing: processingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      penjoki: {
        total: totalPenjoki,
        online: onlinePenjoki,
        busy: busyPenjoki,
        offline: totalPenjoki - onlinePenjoki - busyPenjoki,
      },
      distribution: {
        total: totalDistributions,
        accepted: acceptedDistributions,
        rejected: rejectedDistributions,
        timeout: timeoutDistributions,
        acceptanceRate,
      },
      revenue: {
        totalRevenue: revenueResult._sum.price || 0,
        totalCommission: revenueResult._sum.commission || 0,
        profit: (revenueResult._sum.price || 0) - (revenueResult._sum.commission || 0),
      },
      topPenjoki,
      recentActivity,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
