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

      // Broadcast status change (non-blocking — don't fail the request if Pusher errors)
      try {
        await Promise.all([
          pusherServer.trigger(CHANNELS.DISTRIBUTION, EVENTS.PENJOKI_STATUS_CHANGED, {
            penjokiId: id,
            status: penjoki.status,
            name: penjoki.name,
          }),
          pusherServer.trigger(CHANNELS.ADMIN, EVENTS.PENJOKI_STATUS_CHANGED, {
            penjokiId: id,
            status: penjoki.status,
            name: penjoki.name,
          }),
        ]);
      } catch (pusherError) {
        console.error('Pusher broadcast error (non-fatal):', pusherError);
      }

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

    // Handle avatar update (penjoki can update their own, admin can update any)
    if (updateData.avatar !== undefined) {
      // Validate base64 image (max ~2MB)
      if (typeof updateData.avatar === 'string' && updateData.avatar.length > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran foto maksimal 2MB' }, { status: 400 });
      }
      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: { avatar: updateData.avatar || null },
      });
      return NextResponse.json({ success: true, penjoki });
    }

    // Handle specialization update (penjoki can update their own, admin can update any)
    if (updateData.specialization !== undefined) {
      if (!Array.isArray(updateData.specialization)) {
        return NextResponse.json({ error: 'Specialization harus berupa array' }, { status: 400 });
      }
      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: { specialization: updateData.specialization },
      });
      return NextResponse.json({ success: true, penjoki });
    }

    // Handle rating update (admin only)
    if (updateData.rating !== undefined) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Hanya admin yang bisa memberi rating' }, { status: 403 });
      }
      const rating = Number(updateData.rating);
      if (isNaN(rating) || rating < 0 || rating > 5) {
        return NextResponse.json({ error: 'Rating harus antara 0-5' }, { status: 400 });
      }
      const penjoki = await prisma.penjoki.update({
        where: { id },
        data: { rating },
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
