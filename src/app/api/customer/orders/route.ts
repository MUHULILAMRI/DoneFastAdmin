import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { startDistribution, generateOrderNumber } from '@/lib/distribution-engine';

// GET - List orders for the currently logged-in customer
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      customerId: user.userId,
    };

    if (status && status !== 'ALL') where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        penjoki: {
          select: { id: true, name: true, rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Stats
    const stats = {
      total: orders.length,
      waiting: orders.filter(o => o.status === 'WAITING' || o.status === 'SEARCHING').length,
      processing: orders.filter(o => o.status === 'ACCEPTED' || o.status === 'PROCESSING').length,
      completed: orders.filter(o => o.status === 'COMPLETED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
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
