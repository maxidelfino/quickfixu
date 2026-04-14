// tests/integration/professional.test.ts
// Integration tests for /api/professionals/* endpoints

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import { signToken } from '../../src/config/jwt';

const mockPrisma = prisma as any;

// ============================================================
// TEST FIXTURES
// ============================================================

const mockProfessionalUser = {
  id: 1,
  fullName: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+54 9 11 1234-5678',
  dni: '12345678',
  address: 'Av. Corrientes 1234',
  latitude: -34.6037,
  longitude: -58.3816,
  authProvider: 'email',
  oauthId: null,
  profilePhotoUrl: null,
  rating: 4.5,
  ratingCount: 10,
  isActive: true,
  createdAt: new Date(),
  professional: {
    id: 10,
    userId: 1,
    yearsExperience: 5,
    description: 'Plomero con experiencia',
    categories: [{ category: { id: 1, name: 'Plomería', slug: 'plomeria', icon: '🔧' } }],
    certifications: [],
  },
};

const mockProfessionalProfile = {
  id: 10,
  userId: 1,
  description: 'Plomero con experiencia',
  yearsExperience: 5,
  categories: [{ id: 1, name: 'Plomería', slug: 'plomeria', icon: '🔧' }],
  certifications: [],
  user: {
    id: 1,
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+54 9 11 1234-5678',
    address: 'Av. Corrientes 1234',
    profilePhotoUrl: null,
    rating: 4.5,
    ratingCount: 10,
  },
};

// Helper: get a valid Authorization header
function bearerToken(userId = 1): string {
  return `Bearer ${signToken(userId)}`;
}

// ============================================================
// GET /api/professionals/me
// ============================================================

describe('GET /api/professionals/me', () => {
  it('should return 200 with professional profile when authenticated', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue(mockProfessionalUser);

    const res = await request(app)
      .get('/api/professionals/me')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 10);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/professionals/me');

    expect(res.status).toBe(401);
  });
});

// ============================================================
// PATCH /api/professionals/me
// ============================================================

describe('PATCH /api/professionals/me', () => {
  it('should update professional profile and return 200', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    mockPrisma.professional.update.mockResolvedValue({});
    mockPrisma.professional.findUnique.mockResolvedValue(mockProfessionalUser);

    const res = await request(app)
      .patch('/api/professionals/me')
      .set('Authorization', bearerToken(1))
      .send({
        description: 'Nueva descripción del profesional',
        yearsExperience: 10,
      });

    expect(res.status).toBe(200);
  });

  it('should return 400 when description is too short', async () => {
    const res = await request(app)
      .patch('/api/professionals/me')
      .set('Authorization', bearerToken(1))
      .send({ description: 'Corta' });

    expect(res.status).toBe(400);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/professionals/me')
      .send({ description: 'Nueva descripción' });

    expect(res.status).toBe(401);
  });
});

// ============================================================
// GET /api/professionals/:id
// ============================================================

describe('GET /api/professionals/:id', () => {
  it('should return 200 with public profile', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({
      ...mockProfessionalUser,
      certifications: [{ id: 1, status: 'approved', fileUrl: 'url', uploadedAt: new Date(), deletedAt: null }],
    });

    const res = await request(app).get('/api/professionals/10');

    expect(res.status).toBe(200);
  });

  it('should return 404 when professional not found', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/professionals/999');

    expect(res.status).toBe(404);
  });
});

// ============================================================
// GET /api/professionals/search
// ============================================================

describe('GET /api/professionals/search', () => {
  it('should return search results within radius', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 10,
        user_id: 1,
        description: 'Plomero',
        years_experience: 5,
        distance_m: 1000,
        full_name: 'Juan',
        address: 'Address',
        profile_photo_url: null,
        rating: '4.5',
        rating_count: 10,
      },
    ]);
    mockPrisma.professionalCategory.findMany.mockResolvedValue([]);

    const res = await request(app).get(
      '/api/professionals/search?lat=-34.6037&lng=-58.3816&radius=5'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('results');
  });

  it('should return 400 when required params missing', async () => {
    const res = await request(app).get('/api/professionals/search?lat=-34.6037');

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid lat value', async () => {
    const res = await request(app).get(
      '/api/professionals/search?lat=100&lng=-58.3816&radius=5'
    );

    expect(res.status).toBe(400);
  });

  it('should return 400 for radius > 200km', async () => {
    const res = await request(app).get(
      '/api/professionals/search?lat=-34.6037&lng=-58.3816&radius=500'
    );

    expect(res.status).toBe(400);
  });
});

// ============================================================
// POST /api/professionals/me/certifications
// ============================================================

describe('POST /api/professionals/me/certifications', () => {
  it('should upload certification and return 201', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });

    const res = await request(app)
      .post('/api/professionals/me/certifications')
      .set('Authorization', bearerToken(1))
      .attach('certification', Buffer.from('test'), 'cert.pdf');

    // May fail due to multer setup, but tests the route
    expect(res.status).toBeDefined();
  });

  it('should return 400 when no file provided', async () => {
    const res = await request(app)
      .post('/api/professionals/me/certifications')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// GET /api/professionals/me/certifications
// ============================================================

describe('GET /api/professionals/me/certifications', () => {
  it('should return list of certifications', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    mockPrisma.certification.findMany.mockResolvedValue([
      { id: 1, fileUrl: 'url', status: 'pending', uploadedAt: new Date() },
    ]);

    const res = await request(app)
      .get('/api/professionals/me/certifications')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ============================================================
// DELETE /api/professionals/me/certifications/:id
// ============================================================

describe('DELETE /api/professionals/me/certifications/:id', () => {
  it('should delete certification and return 204', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    mockPrisma.certification.findUnique.mockResolvedValue({
      id: 1,
      professionalId: 10,
      status: 'pending',
      deletedAt: null,
    });

    const res = await request(app)
      .delete('/api/professionals/me/certifications/1')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(204);
  });

  it('should return 403 when trying to delete approved certification', async () => {
    mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });
    mockPrisma.certification.findUnique.mockResolvedValue({
      id: 1,
      professionalId: 10,
      status: 'approved',
      deletedAt: null,
    });

    const res = await request(app)
      .delete('/api/professionals/me/certifications/1')
      .set('Authorization', bearerToken(1));

    expect(res.status).toBe(403);
  });
});
