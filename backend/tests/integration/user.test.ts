// tests/integration/user.test.ts
// Integration tests for /api/users/* endpoints

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import { signToken } from '../../src/config/jwt';

const mockPrisma = prisma as any;

// ============================================================
// TEST FIXTURES
// ============================================================

const mockUser = {
  id: 1,
  fullName: 'Carlos López',
  email: 'carlos@example.com',
  phone: '+54 9 11 9876-5432',
  dni: '87654321',
  address: 'Av. Santa Fe 500, Buenos Aires',
  latitude: -34.5956,
  longitude: -58.3769,
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

// Helper: get a valid Authorization header
function bearerToken(userId = 1): string {
  return `Bearer ${signToken(userId)}`;
}

// ============================================================
// GET /api/users/me
// ============================================================

describe('GET /api/users/me', () => {
  it('should return 200 with user data when authenticated', async () => {
    // requireAuth: findUnique for JWT verification
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser, professional: null }) // requireAuth
      .mockResolvedValue(mockUser); // getProfile

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'carlos@example.com');
    expect(res.body).toHaveProperty('role', 'client');
  });

  it('should return 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
  });
});

// ============================================================
// PATCH /api/users/me
// ============================================================

describe('PATCH /api/users/me', () => {
  it('should return 200 with updated profile', async () => {
    const updatedUser = { ...mockUser, fullName: 'Carlos R. López' };

    // requireAuth call
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser, professional: null }) // requireAuth
      .mockResolvedValueOnce(mockUser) // updateProfile: check user exists
      .mockResolvedValue(updatedUser); // getProfile after update

    mockPrisma.user.update.mockResolvedValue({
      ...updatedUser,
      professional: null,
      certifications: [],
      categories: [],
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(1))
      .send({ fullName: 'Carlos R. López' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fullName', 'Carlos R. López');
  });

  it('should return 400 when phone format is invalid', async () => {
    // requireAuth call
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, professional: null });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(1))
      .send({ phone: '123456789' }); // invalid format

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ fullName: 'New Name' });

    expect(res.status).toBe(401);
  });
});
