import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// PATCH - Update penjoki status
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
    const { status, action, ...updateData } = body;

    // Only allow penjoki to update their own status, or admin to update any
    if (user.role !== 'ADMIN' && user.penjokiId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle go online/offline
    if (status) {
      const updatePayload: Record<string, unknown> = { status };
      
      if (status === 'ONLINE' || status === 'AVAILABLE') {
        updatePayload.lastOnline = new Date();
      }

      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: updatePayload,
      });

      // Broadcast status change
      await pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.PENJOKI_STATUS_CHANGED, {
        penjokiId: id,
        status: penjoki.status,
        name: penjoki.name,
      });

      await pusherServer.trigger(CHANNELS.ADMIN, EVENTS.PENJOKI_STATUS_CHANGED, {
        penjokiId: id,
        status: penjoki.status,
        name: penjoki.name,
      });

      return NextResponse.json({ success: true, penjoki });
    }

    // Handle suspend/unsuspend (admin only)
    if (action === 'suspend') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: {
          isSuspended: true,
          status: 'OFFLINE',
          suspendReason: updateData.suspendReason || 'Disuspend oleh admin',
          suspendUntil: updateData.suspendUntil ? new Date(updateData.suspendUntil) : null,
        },
      });

      return NextResponse.json({ success: true, penjoki });
    }

    if (action === 'unsuspend') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: {
          isSuspended: false,
          suspendReason: null,
          suspendUntil: null,
        },
      });

      return NextResponse.json({ success: true, penjoki });
    }

    // Generic update
    const penjoki = await prisma.penjoki.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, penjoki });
  } catch (error) {
    console.error('Penjoki update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET - Get single penjoki details
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

    const penjoki = await prisma.penjoki.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        distributions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            order: { select: { orderNumber: true, serviceType: true, price: true } },
          },
        },
      },
    });

    if (!penjoki) {
      return NextResponse.json({ error: 'Penjoki not found' }, { status: 404 });
    }

    return NextResponse.json(penjoki);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
