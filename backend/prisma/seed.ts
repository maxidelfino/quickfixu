// prisma/seed.ts
// Seed database with initial categories and test users for QuickFixU

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const shouldSeedDemoUsers =
    process.env.SEED_DEMO_USERS === 'true' &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');

  // Create 3 initial categories
  const categories = [
    {
      name: 'Electricista',
      slug: 'electricista',
      icon: '⚡',
    },
    {
      name: 'Plomero',
      slug: 'plomero',
      icon: '🔧',
    },
    {
      name: 'Gasista',
      slug: 'gasista',
      icon: '🔥',
    },
  ];

  console.log('📦 Creating categories...');

  for (const category of categories) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {}, // Don't update if exists
      create: category,
    });
    console.log(`  ✅ ${created.name} (${created.icon})`);
  }

  if (!shouldSeedDemoUsers) {
    console.log('ℹ️  Demo users skipped. Set SEED_DEMO_USERS=true in local development/test to create them.');
    console.log('');
    console.log('✨ Seed completed successfully!');
    return;
  }

  // ============================================================
  // DEMO USERS (LOCAL DEV/TEST ONLY)
  // ============================================================

  console.log('👤 Creating local demo users...');

  // Test Client User
  const testClient = await prisma.user.upsert({
    where: { email: 'test-cliente@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Cliente',
      email: 'test-cliente@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 1234-5678',
      dni: '12345678',
      address: 'Av. Corrientes 1234, Buenos Aires',
      latitude: -34.6037,
      longitude: -58.3816,
      authProvider: 'email',
      isActive: true,
    },
  });
  console.log(`  ✅ Client: ${testClient.email}`);

  // Fetch category IDs by slug (safe, no hardcoded IDs)
  const catElectricista = await prisma.category.findUnique({ where: { slug: 'electricista' } });
  const catPlomero = await prisma.category.findUnique({ where: { slug: 'plomero' } });
  const catGasista = await prisma.category.findUnique({ where: { slug: 'gasista' } });

  if (!catElectricista || !catPlomero || !catGasista) {
    throw new Error('Required categories not found. Run seed again after categories are created.');
  }

  // Test Professional User (Electricista)
  const testPro = await prisma.user.upsert({
    where: { email: 'test-pro@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Profesional',
      email: 'test-pro@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 9876-5432',
      dni: '87654321',
      address: 'Av. Santa Fe 2345, Buenos Aires',
      latitude: -34.5950,
      longitude: -58.3950,
      authProvider: 'email',
      isActive: true,
      professional: {
        create: {
          yearsExperience: 5,
          description:
            'Electricista matriculado con 5 años de experiencia en instalaciones residenciales y comerciales.',
          categories: {
            create: [{ categoryId: catElectricista.id }],
          },
        },
      },
    },
  });
  console.log(`  ✅ Professional (Electricista): ${testPro.email}`);

  // Solo Plomero
  const testPlomero = await prisma.user.upsert({
    where: { email: 'test-plomero@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Plomero',
      email: 'test-plomero@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 1111-2222',
      dni: '11112222',
      address: 'Av. Rivadavia 3456, Buenos Aires',
      latitude: -34.6057,
      longitude: -58.3836,
      authProvider: 'email',
      isActive: true,
      professional: {
        create: {
          yearsExperience: 8,
          description:
            'Plomero con 8 años de experiencia en instalaciones y reparaciones de cañerías residenciales.',
          categories: {
            create: [{ categoryId: catPlomero.id }],
          },
        },
      },
    },
  });
  console.log(`  ✅ Professional (Plomero): ${testPlomero.email}`);

  // Solo Gasista
  const testGasista = await prisma.user.upsert({
    where: { email: 'test-gasista@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Gasista',
      email: 'test-gasista@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 3333-4444',
      dni: '33334444',
      address: 'Av. Cabildo 1234, Buenos Aires',
      latitude: -34.5617,
      longitude: -58.4596,
      authProvider: 'email',
      isActive: true,
      professional: {
        create: {
          yearsExperience: 6,
          description:
            'Gasista matriculado con 6 años de experiencia en instalaciones de gas natural y GNC.',
          categories: {
            create: [{ categoryId: catGasista.id }],
          },
        },
      },
    },
  });
  console.log(`  ✅ Professional (Gasista): ${testGasista.email}`);

  // Solo Electricista 2
  const testElectricista2 = await prisma.user.upsert({
    where: { email: 'test-electricista2@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Electricista 2',
      email: 'test-electricista2@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 5555-6666',
      dni: '55556666',
      address: 'Av. Belgrano 890, Buenos Aires',
      latitude: -34.6117,
      longitude: -58.3696,
      authProvider: 'email',
      isActive: true,
      professional: {
        create: {
          yearsExperience: 3,
          description:
            'Electricista con 3 años de experiencia especializado en domótica y automatización del hogar.',
          categories: {
            create: [{ categoryId: catElectricista.id }],
          },
        },
      },
    },
  });
  console.log(`  ✅ Professional (Electricista 2): ${testElectricista2.email}`);

  // Plomero + Gasista (multi-category)
  const testMulti = await prisma.user.upsert({
    where: { email: 'test-multi@quickfixu.com' },
    update: {},
    create: {
      fullName: 'Test Multi Profesional',
      email: 'test-multi@quickfixu.com',
      passwordHash: await bcrypt.hash('TestPass123!', 12),
      phone: '+54 9 11 7777-8888',
      dni: '77778888',
      address: 'Av. Independencia 567, Buenos Aires',
      latitude: -34.6197,
      longitude: -58.3956,
      authProvider: 'email',
      isActive: true,
      professional: {
        create: {
          yearsExperience: 10,
          description:
            'Profesional con 10 años de experiencia en plomería y gas. Atiendo urgencias las 24hs.',
          categories: {
            create: [
              { categoryId: catPlomero.id },
              { categoryId: catGasista.id },
            ],
          },
        },
      },
    },
  });
  console.log(`  ✅ Professional (Plomero + Gasista): ${testMulti.email}`);

  console.log('');
  console.log('🔑 Local demo credentials:');
  console.log('   Client        → test-cliente@quickfixu.com      / TestPass123!');
  console.log('   Pro (Elec)    → test-pro@quickfixu.com          / TestPass123!');
  console.log('   Pro (Plom)    → test-plomero@quickfixu.com      / TestPass123!');
  console.log('   Pro (Gas)     → test-gasista@quickfixu.com      / TestPass123!');
  console.log('   Pro (Elec 2)  → test-electricista2@quickfixu.com / TestPass123!');
  console.log('   Pro (Multi)   → test-multi@quickfixu.com        / TestPass123!');
  console.log('');
  console.log('✨ Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
