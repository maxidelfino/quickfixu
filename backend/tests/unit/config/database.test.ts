// tests/unit/config/database.test.ts
// Unit tests for Prisma Client singleton

import prisma from '../../../src/config/database';

// Test the mocked Prisma client from setup.ts
describe('Database Configuration', () => {
  it('should export a PrismaClient-like instance', () => {
    // In test environment, prisma is mocked in setup.ts
    expect(prisma).toBeDefined();
    expect(prisma).toHaveProperty('user');
    expect(prisma).toHaveProperty('professional');
    expect(prisma).toHaveProperty('refreshToken');
    expect(prisma).toHaveProperty('$transaction');
  });

  it('should have user model with required methods', () => {
    expect(prisma.user).toBeDefined();
    expect(typeof prisma.user.findUnique).toBe('function');
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.user.update).toBe('function');
  });

  it('should have professional model available', () => {
    expect(prisma.professional).toBeDefined();
    expect(typeof prisma.professional.findUnique).toBe('function');
    expect(typeof prisma.professional.create).toBe('function');
  });

  it('should have refreshToken model available', () => {
    expect(prisma.refreshToken).toBeDefined();
    expect(typeof prisma.refreshToken.create).toBe('function');
    expect(typeof prisma.refreshToken.findUnique).toBe('function');
  });

  it('should have $transaction method', () => {
    expect(typeof prisma.$transaction).toBe('function');
  });
});
