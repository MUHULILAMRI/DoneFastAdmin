import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'donefast-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  penjokiId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(request?: NextRequest): Promise<JWTPayload | null> {
  let token: string | undefined;

  if (request) {
    // From request headers or cookies
    token = request.cookies.get('auth-token')?.value;
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
  } else {
    // From Next.js cookies (server components)
    const cookieStore = await cookies();
    token = cookieStore.get('auth-token')?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(request: NextRequest, requiredRole?: string): Promise<JWTPayload> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (requiredRole && user.role !== requiredRole) {
    throw new Error('Forbidden');
  }
  return user;
}

export async function requireAdmin(request: NextRequest): Promise<JWTPayload> {
  return requireAuth(request, 'ADMIN');
}

export async function requirePenjoki(request: NextRequest): Promise<JWTPayload> {
  return requireAuth(request, 'PENJOKI');
}

export async function requireCustomer(request: NextRequest): Promise<JWTPayload> {
  return requireAuth(request, 'CUSTOMER');
}
