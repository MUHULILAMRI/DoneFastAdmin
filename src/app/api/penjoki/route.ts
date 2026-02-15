import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET - List penjoki
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const online = searchParams.get('online');

    const where: Record<string, unknown> = { isActive: true };
    
    if (status) where.status = status;
    if (online === 'true') {
      where.status = { in: ['ONLINE', 'AVAILABLE'] };
    }

    const penjokis = await prisma.penjoki.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        rating: true,
        totalOrder: true,
        completedOrder: true,
        rejectedOrder: true,
        level: true,
        specialization: true,
        isActive: true,
        isSuspended: true,
        lastOnline: true,
        balance: true,
        totalEarnings: true,
        commissionRate: true,
        createdAt: true,
      },
      orderBy: { rating: 'desc' },
    });

    return NextResponse.json({ penjokis });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Create penjoki (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, phone, specialization, commissionRate } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Nama dan email wajib' }, { status: 400 });
    }

    // Check if user exists
    let targetUser = await prisma.user.findUnique({ where: { email } });
    
    if (!targetUser) {
      // Create user automatically
      const { hashPassword } = await import('@/lib/auth');
      targetUser = await prisma.user.create({
        data: {
          name,
          email,
          password: await hashPassword('donefast123'), // Default password
          role: 'PENJOKI',
        },
      });
    }

    const penjoki = await prisma.penjoki.create({
      data: {
        userId: targetUser.id,
        name,
        email,
        phone,
        specialization: specialization || [],
        commissionRate: commissionRate || 0.8,
      },
    });

    return NextResponse.json({ success: true, penjoki }, { status: 201 });
  } catch (error) {
    console.error('Create penjoki error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
