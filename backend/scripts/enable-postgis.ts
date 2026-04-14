import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🔍 Checking if PostGIS is enabled...');

  // Check if PostGIS extension exists
  const result = await prisma.$queryRaw<{ extname: string; extversion: string }[]>`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'
  `;

  if (result.length === 0) {
    console.log('📦 Enabling PostGIS extension...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS postgis`;
    console.log('✅ PostGIS enabled successfully!');
  } else {
    console.log('✅ PostGIS is already enabled!');
  }

  // Check if location column exists in users table
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'location'
  `;

  if (columns.length === 0) {
    console.log('📦 Adding location column to users table...');
    await prisma.$executeRaw`ALTER TABLE users ADD COLUMN location GEOGRAPHY(POINT, 4326)`;
    console.log('✅ Location column added!');
  } else {
    console.log('✅ Location column already exists!');
  }

  // Create spatial index
  console.log('📦 Creating spatial index...');
  try {
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location)`;
    console.log('✅ Spatial index created!');
  } catch (e) {
    console.log('⚠️  Index might already exist:', e);
  }

  console.log('\n🎉 PostGIS setup complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
