import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { startDistribution, generateOrderNumber } from '@/lib/distribution-engine';

// GET - List orders
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const penjokiId = searchParams.get('penjokiId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    
    // Penjoki can only see their own orders
    if (user.role === 'PENJOKI' && user.penjokiId) {
      where.penjokiId = user.penjokiId;
    } else if (user.role === 'CUSTOMER') {
      where.customerId = user.userId;
    } else if (penjokiId) {
      where.penjokiId = penjokiId;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          penjoki: { select: { id: true, name: true, email: true, rating: true } },
          distributions: {
            include: {
              penjoki: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Create new order and start distribution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      serviceType,
      description,
      requirements,
      deadline,
      price,
      priority,
      distributionStrategy,
      autoDistribute = true,
    } = body;

    if (!customerName || !serviceType || !description || !price) {
      return NextResponse.json(
        { error: 'Data order tidak lengkap' },
        { status: 400 }
      );
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName,
        customerEmail,
        customerPhone,
        customerId: body.customerId || undefined,
        serviceType,
        description,
        requirements,
        deadline: deadline ? new Date(deadline) : null,
        price: parseFloat(price),
        priority: priority || 0,
        distributionStrategy: distributionStrategy || 'RATING',
        status: 'WAITING',
      },
    });

    // Start automatic distribution if enabled
    let distributionResult = null;
    if (autoDistribute) {
      distributionResult = await startDistribution(order.id);
    }

    return NextResponse.json({
      success: true,
      order,
      distribution: distributionResult,
    }, { status: 201 });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Gagal membuat order' }, { status: 500 });
  }
}
