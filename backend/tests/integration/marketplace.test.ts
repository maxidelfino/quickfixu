// tests/integration/marketplace.test.ts
// Integration tests for marketplace request/proposal/appointment flow

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import { signToken } from '../../src/config/jwt';

const mockPrisma = prisma as any;

function bearerToken(userId: number): string {
  return `Bearer ${signToken(userId)}`;
}

const clientAuthUser = {
  id: 1,
  email: 'client@example.com',
  isActive: true,
  professional: null,
};

const professionalAuthUser = {
  id: 2,
  email: 'pro@example.com',
  isActive: true,
  professional: { id: 20, userId: 2 },
};

const requestRecord = {
  id: 101,
  userId: 1,
  title: 'Electricity outage in kitchen',
  description: 'Need an electrician to inspect a repeated outage in the kitchen area.',
  latitude: -34.6037,
  longitude: -58.3816,
  status: 'published',
  expiresAt: new Date('2026-04-25T12:00:00.000Z'),
  createdAt: new Date('2026-04-18T10:00:00.000Z'),
  updatedAt: new Date('2026-04-18T10:00:00.000Z'),
  deletedAt: null,
  user: { id: 1, fullName: 'Client User' },
  categories: [{ category: { id: 3, name: 'Electricidad', slug: 'electricidad', icon: '⚡' } }],
  media: [{ id: 501, mediaType: 'image', mediaUrl: 'https://cdn.quickfixu.test/request-1.jpg' }],
  proposals: [],
};

const professionalRecord = {
  id: 20,
  userId: 2,
  description: 'Licensed electrician with emergency support.',
  yearsExperience: 8,
  user: { id: 2, fullName: 'Professional User', rating: 4.8, ratingCount: 12 },
};

const proposalRecord = {
  id: 201,
  requestId: 101,
  professionalId: 20,
  priceReference: 25000,
  scopeNotes: 'Includes diagnostics, replacement recommendation, and labor estimate.',
  proposedDate: new Date('2026-04-24T00:00:00.000Z'),
  proposedTime: new Date('2026-04-24T15:30:00.000Z'),
  status: 'sent',
  expiresAt: new Date('2026-04-26T18:00:00.000Z'),
  createdAt: new Date('2026-04-18T11:00:00.000Z'),
  updatedAt: new Date('2026-04-18T11:00:00.000Z'),
  request: {
    id: 101,
    userId: 1,
    title: 'Electricity outage in kitchen',
    status: 'receiving_proposals',
  },
  professional: professionalRecord,
  appointment: null,
};

const coordinatingAppointment = {
  id: 301,
  proposalId: 201,
  requestId: 101,
  status: 'coordinating',
  scheduledDate: new Date('2026-04-24T00:00:00.000Z'),
  scheduledTime: new Date('2026-04-24T15:30:00.000Z'),
  rescheduledCount: 0,
  clientConfirmedCompletionAt: null,
  professionalConfirmedCompletionAt: null,
  completedAt: null,
  createdAt: new Date('2026-04-18T12:00:00.000Z'),
  updatedAt: new Date('2026-04-18T12:00:00.000Z'),
  request: {
    id: 101,
    userId: 1,
    title: 'Electricity outage in kitchen',
    status: 'in_coordination',
  },
  proposal: {
    id: 201,
    professionalId: 20,
    priceReference: 25000,
    scopeNotes: 'Includes diagnostics, replacement recommendation, and labor estimate.',
    professional: {
      id: 20,
      user: { id: 2, fullName: 'Professional User' },
    },
  },
};

describe('Marketplace API', () => {
  beforeEach(() => {
    mockPrisma.$transaction = jest.fn(async (callback: any) => callback(mockPrisma));
    mockPrisma.proposal.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    mockPrisma.request.create.mockResolvedValue({ id: 101 });
    mockPrisma.request.findUnique.mockResolvedValue(requestRecord);
    mockPrisma.request.findMany.mockResolvedValue([requestRecord]);
    mockPrisma.request.update.mockResolvedValue({ ...requestRecord, status: 'receiving_proposals' });
    mockPrisma.requestCategory.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.requestMedia.create.mockResolvedValue({ id: 501 });
    mockPrisma.professional.findUnique.mockResolvedValue(professionalRecord);
    mockPrisma.proposal.create.mockResolvedValue({ id: 201 });
    mockPrisma.proposal.findUnique.mockResolvedValue(proposalRecord);
    mockPrisma.proposal.findMany.mockResolvedValue([proposalRecord]);
    mockPrisma.proposal.update.mockResolvedValue({ ...proposalRecord, status: 'accepted' });
    mockPrisma.appointment.create.mockResolvedValue(coordinatingAppointment);
    mockPrisma.appointment.findUnique.mockResolvedValue(coordinatingAppointment);
    mockPrisma.appointment.update.mockImplementation(async ({ data }: any) => ({
      ...coordinatingAppointment,
      ...data,
    }));
  });

  describe('POST /api/requests', () => {
    it('should create a published request for a client', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', bearerToken(1))
        .send({
          title: 'Electricity outage in kitchen',
          description: 'Need an electrician to inspect a repeated outage in the kitchen area.',
          latitude: -34.6037,
          longitude: -58.3816,
          expiresAt: '2026-04-25T12:00:00.000Z',
          categoryIds: [3],
          media: [
            {
              mediaType: 'image',
              mediaUrl: 'https://cdn.quickfixu.test/request-1.jpg',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Electricity outage in kitchen',
        status: 'published',
      });
    });

    it('should reject professionals creating marketplace requests', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(professionalAuthUser);

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', bearerToken(2))
        .send({
          title: 'Need plumbing help',
          description: 'There is a leak in the bathroom that needs urgent review.',
          latitude: -34.6037,
          longitude: -58.3816,
          expiresAt: '2026-04-25T12:00:00.000Z',
          categoryIds: [4],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/requests', () => {
    it('should list open requests for professionals', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(professionalAuthUser);

      const res = await request(app)
        .get('/api/requests')
        .set('Authorization', bearerToken(2));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 1);
      expect(res.body.requests[0]).toMatchObject({
        id: 101,
        status: 'published',
      });
    });
  });

  describe('GET /api/requests/:id', () => {
    it('should return a single request detail for the owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);

      const res = await request(app)
        .get('/api/requests/101')
        .set('Authorization', bearerToken(1));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 101,
        title: 'Electricity outage in kitchen',
      });
    });
  });

  describe('POST /api/proposals', () => {
    it('should create a proposal from a professional', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(professionalAuthUser);

      const res = await request(app)
        .post('/api/proposals')
        .set('Authorization', bearerToken(2))
        .send({
          requestId: 101,
          priceReference: 25000,
          scopeNotes: 'Includes diagnostics, replacement recommendation, and labor estimate.',
          proposedDate: '2026-04-24',
          proposedTime: '2026-04-24T15:30:00.000Z',
          expiresAt: '2026-04-26T18:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        requestId: 101,
        status: 'sent',
        priceReference: 25000,
      });
    });

    it('should reject clients creating proposals', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);

      const res = await request(app)
        .post('/api/proposals')
        .set('Authorization', bearerToken(1))
        .send({
          requestId: 101,
          priceReference: 25000,
          scopeNotes: 'Includes diagnostics and a repair estimate.',
          expiresAt: '2026-04-26T18:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/requests/:requestId/proposals', () => {
    it('should list proposals for the owning client request', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);

      const res = await request(app)
        .get('/api/requests/101/proposals')
        .set('Authorization', bearerToken(1));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 1);
      expect(res.body.proposals[0]).toMatchObject({
        id: 201,
        requestId: 101,
      });
    });
  });

  describe('GET /api/proposals/:id', () => {
    it('should return a proposal detail for the owning professional', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(professionalAuthUser);

      const res = await request(app)
        .get('/api/proposals/201')
        .set('Authorization', bearerToken(2));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 201,
        status: 'sent',
      });
    });
  });

  describe('POST /api/proposals/:id/accept', () => {
    it('should accept a proposal and create an appointment', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);

      const res = await request(app)
        .post('/api/proposals/201/accept')
        .set('Authorization', bearerToken(1));

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        proposalId: 201,
        requestId: 101,
        status: 'coordinating',
      });
    });

    it('should reject accepting a proposal from a non-owner client', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...clientAuthUser,
        id: 99,
        email: 'other-client@example.com',
      });

      const res = await request(app)
        .post('/api/proposals/201/accept')
        .set('Authorization', bearerToken(99));

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/appointments/:id/confirm-completion', () => {
    it('should move appointment to pending completion after first confirmation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(clientAuthUser);
      mockPrisma.appointment.findUnique.mockResolvedValue(coordinatingAppointment);

      const res = await request(app)
        .post('/api/appointments/301/confirm-completion')
        .set('Authorization', bearerToken(1));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 301,
        status: 'pending_completion_confirmation',
      });
      expect(res.body.clientConfirmedCompletionAt).toBeTruthy();
      expect(res.body.completedAt).toBeNull();
    });

    it('should complete appointment after bilateral confirmation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(professionalAuthUser);
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...coordinatingAppointment,
        status: 'pending_completion_confirmation',
        clientConfirmedCompletionAt: new Date('2026-04-18T13:00:00.000Z'),
      });

      const res = await request(app)
        .post('/api/appointments/301/confirm-completion')
        .set('Authorization', bearerToken(2));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 301,
        status: 'completed',
      });
      expect(res.body.professionalConfirmedCompletionAt).toBeTruthy();
      expect(res.body.completedAt).toBeTruthy();
    });
  });
});
