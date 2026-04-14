// src/config/database.ts
// Prisma Client singleton pattern for database connections

import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
// (hot reloading can cause connection pool exhaustion)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
