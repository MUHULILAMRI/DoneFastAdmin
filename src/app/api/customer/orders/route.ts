import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { startDistribution, generateOrderNumber } from '@/lib/distribution-engine';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// GET - List orders for the currently logged-in customer
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      customerId: user.userId,
    };

    if (status && status !== 'ALL') where.status = status;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { serviceType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        penjoki: {
          select: { id: true, name: true, rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Stats (count from ALL orders, not filtered)
    const allOrders = await prisma.order.findMany({
      where: { customerId: user.userId },
      select: { status: true },
    });

    const stats = {
      total: allOrders.length,
      waiting: allOrders.filter(o => o.status === 'WAITING' || o.status === 'SEARCHING').length,
      processing: allOrders.filter(o => o.status === 'ACCEPTED' || o.status === 'PROCESSING').length,
      completed: allOrders.filter(o => o.status === 'COMPLETED').length,
      cancelled: allOrders.filter(o => o.status === 'CANCELLED').length,
    };

    return NextResponse.json({ orders, stats });
  } catch (error) {
    console.error('Customer orders GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Customer creates a new order
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the user's profile
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      serviceType,
      description,
      requirements,
      deadline,
      price,
      phone,
    } = body;

    if (!serviceType || !description || !price) {
      return NextResponse.json(
        { error: 'Tipe layanan, deskripsi, dan harga wajib diisi' },
        { status: 400 }
      );
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: dbUser.name,
        customerEmail: dbUser.email,
        customerPhone: phone || null,
        customerId: dbUser.id,
        serviceType,
        description,
        requirements: requirements || null,
        deadline: deadline ? new Date(deadline) : null,
        price: parseFloat(price),
        status: 'WAITING',
        distributionStrategy: 'RATING',
      },
    });

    // Start automatic distribution
    const distributionResult = await startDistribution(order.id);

    return NextResponse.json({
      success: true,
      order,
      distribution: distributionResult,
    }, { status: 201 });
  } catch (error) {
    console.error('Customer order POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat order' }, { status: 500 });
  }
}

// PATCH - Customer cancel or rate an order
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, action } = body;

    if (!orderId || !action) {
      return NextResponse.json({ error: 'orderId and action required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== user.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ---------- CANCEL ORDER ----------
    if (action === 'cancel') {
      if (!['WAITING', 'SEARCHING'].includes(order.status)) {
        return NextResponse.json(
          { error: 'Order hanya bisa dibatalkan saat status Menunggu atau Mencari Penjoki' },
          { status: 400 }
        );
      }

      const cancelReason = body.reason || 'Dibatalkan oleh customer';

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason,
        },
      });

      // Notify via Pusher
      await pusherServer.trigger(CHANNELS.ORDERS, EVENTS.ORDER_STATUS_CHANGED, {
        orderId,
        status: 'CANCELLED',
        message: `Order ${updated.orderNumber} dibatalkan oleh customer`,
      });

      await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.ORDER_STATUS_CHANGED, {
        orderId,
        status: 'CANCELLED',
        message: `Order ${updated.orderNumber} dibatalkan oleh customer`,
      });

      return NextResponse.json({ success: true, order: updated });
    }

    // ---------- RATE ORDER ----------
    if (action === 'rate') {
      if (order.status !== 'COMPLETED') {
        return NextResponse.json(
          { error: 'Hanya bisa memberikan rating pada order yang sudah selesai' },
          { status: 400 }
        );
      }

      if (order.customerRating) {
        return NextResponse.json(
          { error: 'Anda sudah memberikan rating untuk order ini' },
          { status: 400 }
        );
      }

      const { rating, review } = body;
      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating harus 1-5' }, { status: 400 });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          customerRating: rating,
          customerReview: review || null,
          ratedAt: new Date(),
        },
      });

      // Update penjoki average rating
      if (order.penjokiId) {
        const penjokiOrders = await prisma.order.findMany({
          where: {
            penjokiId: order.penjokiId,
            customerRating: { not: null },
          },
          select: { customerRating: true },
        });

        const avgRating =
          penjokiOrders.reduce((acc, o) => acc + (o.customerRating || 0), 0) /
          penjokiOrders.length;

        await prisma.penjoki.update({
          where: { id: order.penjokiId },
          data: { rating: Math.round(avgRating * 10) / 10 },
        });
      }

      return NextResponse.json({ success: true, order: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Customer order PATCH error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
