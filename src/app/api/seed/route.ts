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

    // Delete old demo users that are no longer needed
    const oldDemoEmails = [
      'admin@donefast.id',
      'ahmad@donefast.id',
      'budi@donefast.id',
      'citra@donefast.id',
      'dian@donefast.id',
      'eka@donefast.id',
    ];
    // Delete penjoki records first (foreign key)
    await prisma.penjoki.deleteMany({
      where: { email: { in: oldDemoEmails } },
    });
    // Then delete user records
    await prisma.user.deleteMany({
      where: { email: { in: oldDemoEmails } },
    });

    // Create Super Admin user
    const superAdminPassword = await hashPassword('@Bulusimba28');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'muhulila0@gmail.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'muhulila0@gmail.com',
        password: superAdminPassword,
        role: 'ADMIN',
      },
    });

    // Create Admin 2 (Pemantau Orderan)
    const admin2Password = await hashPassword('sari10');
    const admin2 = await prisma.user.upsert({
      where: { email: 'sari10@donefast.id' },
      update: {},
      create: {
        name: 'Sari10',
        email: 'sari10@donefast.id',
        password: admin2Password,
        role: 'ADMIN',
      },
    });

    // Create penjoki users
    const penjokiData = [
      { name: 'Syahril Akbar', email: 'syahrilakbar12@donefast.id', password: '@SyahrilAkbar12', phone: '081234567001', specialization: ['Skripsi', 'Makalah'] },
      { name: 'Apu', email: 'apu@donefast.id', password: '@Apu', phone: '081234567002', specialization: ['Programming', 'Web Development'] },
      { name: 'Ulil28', email: 'ulil28@donefast.id', password: 'Ulil28', phone: '081234567003', specialization: ['Desain', 'PPT'] },
      { name: 'Sarii10', email: 'sarii10@donefast.id', password: 'Sarii10', phone: '081234567004', specialization: ['Skripsi', 'Jurnal'] },
      { name: 'Risal88', email: 'risal88@donefast.id', password: 'Risal88', phone: '081234567005', specialization: ['Programming', 'Mobile App'] },
    ];

    const createdPenjoki = [];

    for (const p of penjokiData) {
      const hashedPw = await hashPassword(p.password);
      const user = await prisma.user.upsert({
        where: { email: p.email },
        update: {},
        create: {
          name: p.name,
          email: p.email,
          password: hashedPw,
          role: 'PENJOKI',
        },
      });

      const penjoki = await prisma.penjoki.upsert({
        where: { email: p.email },
        update: { rating: 0 },
        create: {
          userId: user.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          specialization: p.specialization,
          rating: 0,
          status: 'OFFLINE',
        },
      });

      createdPenjoki.push(penjoki);
    }

    // Reset ALL penjoki ratings to 0 (only admin can rate)
    await prisma.penjoki.updateMany({ data: { rating: 0 } });

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
        superAdmin: { email: superAdmin.email, name: superAdmin.name },
        admin2: { email: admin2.email, name: admin2.name },
        penjoki: createdPenjoki.map(p => ({
          name: p.name,
          email: p.email,
        })),
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
