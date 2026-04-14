// tests/integration/auth.test.ts
// Integration tests for /api/auth/* endpoints

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const mockPrisma = prisma as any;

// ============================================================
// TEST FIXTURES
// ============================================================

const validRegisterBody = {
  fullName: 'María García',
  email: 'maria@example.com',
  password: 'Password1!',
  phone: '+54 9 11 1234-5678',
  dni: '12345678',
  address: 'Av. Corrientes 1234, Buenos Aires',
};

const mockCreatedUser = {
  id: 1,
  fullName: 'María García',
  email: 'maria@example.com',
  phone: '+54 9 11 1234-5678',
  dni: '12345678',
  address: 'Av. Corrientes 1234, Buenos Aires',
  latitude: -34.6037,
  longitude: -58.3816,
  authProvider: 'email',
  oauthId: null,
  profilePhotoUrl: null,
  rating: 0,
  ratingCount: 0,
  isActive: true,
  createdAt: new Date(),
  professional: null,
  passwordHash: null,
};

// ============================================================
// POST /api/auth/register
// ============================================================

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
  });

  it('should return 201 with user and tokens on successful registration', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // no existing user
      .mockResolvedValue(mockCreatedUser); // getUserWithRole
    mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('tokens');
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe('maria@example.com');
  });

  it('should return 409 when email is already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockCreatedUser); // email exists

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterBody);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when password does not meet requirements', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegisterBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password1!' });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// POST /api/auth/login
// ============================================================

describe('POST /api/auth/login', () => {
  it('should return 200 with tokens on successful login', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 12);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockCreatedUser, passwordHash }) // login lookup
      .mockResolvedValue(mockCreatedUser); // getUserWithRole
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maria@example.com', password: 'Password1!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tokens');
    expect(res.body.tokens).toHaveProperty('accessToken');
  });

  it('should return 401 for wrong password', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword1!', 12);
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockCreatedUser, passwordHash });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maria@example.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password1!' });

    expect(res.status).toBe(401);
  });

  it('should return 400 when body fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' }); // missing password

    expect(res.status).toBe(400);
  });
});

// ============================================================
// POST /api/auth/refresh
// ============================================================

describe('POST /api/auth/refresh', () => {
  it('should return 200 with new tokens on valid refresh token', async () => {
    const rawToken = 'valid-refresh-token-uuid';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.refreshToken.update.mockResolvedValue({ id: 1, isRevoked: true });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 2 });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: rawToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('should return 401 for an expired refresh token', async () => {
    const rawToken = 'expired-token';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // past
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: rawToken });

    expect(res.status).toBe(401);
  });

  it('should return 401 for an invalid/nonexistent refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'nonexistent-token' });

    expect(res.status).toBe(401);
  });
});

// ============================================================
// POST /api/auth/logout
// ============================================================

describe('POST /api/auth/logout', () => {
  it('should return 200 on successful logout', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'some-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('should return 200 even if token was already revoked (idempotent)', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 }); // 0 rows affected

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'already-revoked-token' });

    expect(res.status).toBe(200);
  });
});
