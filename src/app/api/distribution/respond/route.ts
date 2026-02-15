import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { acceptOrder, rejectOrder, handleTimeout } from '@/lib/distribution-engine';

// POST - Respond to order distribution (accept/reject/timeout)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { distributionId, action, reason, orderId, penjokiId: bodyPenjokiId } = body;

    if (!distributionId || !action) {
      return NextResponse.json(
        { error: 'distributionId dan action wajib' },
        { status: 400 }
      );
    }

    // Resolve penjokiId: dari JWT, body, atau lookup dari database
    let penjokiId = user.penjokiId || bodyPenjokiId;

    if (!penjokiId) {
      // Fallback: cek di database berdasarkan userId
      const penjokiRecord = await prisma.penjoki.findUnique({
        where: { userId: user.userId },
      });
      penjokiId = penjokiRecord?.id;
    }

    if (!penjokiId) {
      return NextResponse.json({ error: 'Penjoki ID required' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'accept':
        result = await acceptOrder(distributionId, penjokiId);
        break;
      case 'reject':
        result = await rejectOrder(distributionId, penjokiId, reason);
        break;
      case 'timeout':
        result = await handleTimeout(distributionId, orderId, penjokiId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Distribution response error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
