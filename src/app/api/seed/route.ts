import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// POST - Seed database with initial data
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Simple protection
    if (secret !== process.env.SEED_SECRET && secret !== 'donefast-seed-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@donefast.id' },
      update: {},
      create: {
        name: 'Admin DoneFast',
        email: 'admin@donefast.id',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    // Create sample penjoki users
    const penjokiData = [
      { name: 'Ahmad Rizki', email: 'ahmad@donefast.id', phone: '081234567001', specialization: ['Skripsi', 'Makalah'] },
      { name: 'Budi Santoso', email: 'budi@donefast.id', phone: '081234567002', specialization: ['Programming', 'Web Development'] },
      { name: 'Citra Dewi', email: 'citra@donefast.id', phone: '081234567003', specialization: ['Desain', 'PPT'] },
      { name: 'Dian Pratama', email: 'dian@donefast.id', phone: '081234567004', specialization: ['Skripsi', 'Jurnal'] },
      { name: 'Eka Putra', email: 'eka@donefast.id', phone: '081234567005', specialization: ['Programming', 'Mobile App'] },
    ];

    const penjokiPassword = await hashPassword('penjoki123');
    const createdPenjoki = [];

    for (const p of penjokiData) {
      const user = await prisma.user.upsert({
        where: { email: p.email },
        update: {},
        create: {
          name: p.name,
          email: p.email,
          password: penjokiPassword,
          role: 'PENJOKI',
        },
      });

      const penjoki = await prisma.penjoki.upsert({
        where: { email: p.email },
        update: {},
        create: {
          userId: user.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          specialization: p.specialization,
          rating: 4.0 + Math.random(),
          status: 'OFFLINE',
        },
      });

      createdPenjoki.push(penjoki);
    }

    // Create system configs
    const configs = [
      { key: 'default_response_timeout', value: '30', description: 'Default timeout in seconds for penjoki to respond' },
      { key: 'max_distribution_attempts', value: '10', description: 'Maximum number of penjoki to try before giving up' },
      { key: 'default_distribution_strategy', value: 'RATING', description: 'Default distribution strategy' },
      { key: 'auto_suspend_threshold', value: '10', description: 'Number of rejections before auto-suspend' },
      { key: 'default_commission_rate', value: '0.8', description: 'Default commission rate (80% for penjoki)' },
    ];

    for (const config of configs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { value: config.value },
        create: config,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        admin: { email: admin.email, password: 'admin123' },
        penjoki: createdPenjoki.map(p => ({
          name: p.name,
          email: p.email,
          password: 'penjoki123',
        })),
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
