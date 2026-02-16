import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { penjoki: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      penjokiId: dbUser.penjoki?.id || null,
      penjoki: dbUser.penjoki ? {
        id: dbUser.penjoki.id,
        status: dbUser.penjoki.status,
        rating: dbUser.penjoki.rating,
        totalOrder: dbUser.penjoki.totalOrder,
        completedOrder: dbUser.penjoki.completedOrder,
        balance: dbUser.penjoki.balance,
        level: dbUser.penjoki.level,
        avatar: dbUser.penjoki.avatar,
        specialization: dbUser.penjoki.specialization,
        phone: dbUser.penjoki.phone,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
