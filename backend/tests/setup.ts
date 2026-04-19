// tests/setup.ts
// Jest global setup - mocks all external dependencies

// Increase Jest timeout for integration tests
jest.setTimeout(10000);

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/quickfixu_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GOOGLE_GEOCODING_API_KEY = 'test-geocoding-key';
process.env.ALLOW_MOCK_CLOUDINARY = 'true';

// ============================================================
// MOCK: Prisma Client
// ============================================================
jest.mock('../src/config/database', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    professional: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    request: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    requestCategory: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    requestMedia: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    proposal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    professionalCategory: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    certification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  return { __esModule: true, default: mockPrisma };
});

// ============================================================
// MOCK: Redis
// ============================================================
jest.mock('../src/config/redis', () => {
  const mockRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  };
  return { __esModule: true, default: mockRedis };
});

// ============================================================
// MOCK: Cloudinary
// ============================================================
jest.mock('../src/config/cloudinary', () => ({
  __esModule: true,
  default: {
    uploader: {
      upload: jest.fn().mockResolvedValue({ secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg' }),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}));

// ============================================================
// MOCK: JWT config (bypass filesystem key loading)
// ============================================================
jest.mock('../src/config/jwt', () => {
  const jwt = require('jsonwebtoken');
  const TEST_SECRET = 'test-secret-key-for-unit-tests';

  return {
    signToken: jest.fn((userId: number): string => {
      return jwt.sign({ userId }, TEST_SECRET, { expiresIn: '15m' });
    }),
    verifyToken: jest.fn((token: string) => {
      return jwt.verify(token, TEST_SECRET);
    }),
  };
});

// ============================================================
// MOCK: Geocoding service (return default Argentina coords)
// ============================================================
jest.mock('../src/services/geocoding.service', () => ({
  geocodingService: {
    geocode: jest.fn().mockResolvedValue({ latitude: -34.6037, longitude: -58.3816 }),
    getCachedGeocode: jest.fn().mockResolvedValue(null),
    cacheGeocode: jest.fn().mockResolvedValue(undefined),
  },
}));

// ============================================================
// MOCK: Axios (prevent real HTTP calls)
// ============================================================
jest.mock('axios');

// ============================================================
// GLOBAL SETUP/TEARDOWN
// ============================================================
beforeEach(() => {
  jest.clearAllMocks();
});
