import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action } = body;

    if (action === 'register') {
      return await handleRegister(body);
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { penjoki: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      penjokiId: user.penjoki?.id,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        penjokiId: user.penjoki?.id,
      },
      token,
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

async function handleRegister(body: {
  name: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
}) {
  const { name, email, password, role = 'PENJOKI', phone } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Nama, email, dan password wajib diisi' },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'Email sudah terdaftar' },
      { status: 400 }
    );
  }

  const hashedPassword = await hashPassword(password);

  const resolvedRole = role === 'ADMIN' ? 'ADMIN' : role === 'CUSTOMER' ? 'CUSTOMER' : 'PENJOKI';

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: resolvedRole,
    },
  });

  // Create penjoki profile if role is PENJOKI
  let penjokiId: string | undefined;
  if (user.role === 'PENJOKI') {
    const penjoki = await prisma.penjoki.create({
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone,
      },
    });
    penjokiId = penjoki.id;
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    penjokiId,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      penjokiId,
    },
    token,
  });

  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
