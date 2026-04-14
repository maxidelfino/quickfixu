// tests/unit/register.validation.test.ts
// Unit tests for register endpoint: schema validation + service-level errors

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';

const mockPrisma = prisma as any;

// ============================================================
// FIXTURES
// ============================================================

/** Baseline valid payload — mutate per test case */
const validPayload = {
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
  passwordHash: null,
  rating: 0,
  ratingCount: 0,
  isActive: true,
  createdAt: new Date(),
  professional: null,
};

// ============================================================
// HELPERS
// ============================================================

/** POST /api/auth/register with the given body */
function postRegister(body: Record<string, unknown>) {
  return request(app).post('/api/auth/register').send(body);
}

// ============================================================
// SCHEMA VALIDATION — 400 cases
// ============================================================

describe('POST /api/auth/register — schema validation', () => {
  // ── Email ──────────────────────────────────────────────────

  describe('email', () => {
    it('should return 400 with specific error when email is invalid', async () => {
      const res = await postRegister({ ...validPayload, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      // The validation error should reference the email field
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const emailError = body.details.find((d) => d.field === 'email');
        expect(emailError).toBeDefined();
      }
    });

    it('should return 400 when email is missing', async () => {
      const { email: _email, ...withoutEmail } = validPayload;
      const res = await postRegister(withoutEmail);
      expect(res.status).toBe(400);
    });

    it('should return 400 when email is empty string', async () => {
      const res = await postRegister({ ...validPayload, email: '' });
      expect(res.status).toBe(400);
    });
  });

  // ── Phone ──────────────────────────────────────────────────

  describe('phone', () => {
    it('should return 400 when phone contains letters', async () => {
      const res = await postRegister({ ...validPayload, phone: 'ABC DEF GHI JKLM-NOPQ' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const phoneError = body.details.find((d) => d.field === 'phone');
        expect(phoneError).toBeDefined();
        expect(phoneError?.message).toMatch(/phone/i);
      }
    });

    it('should return 400 when phone format is wrong (plain number)', async () => {
      const res = await postRegister({ ...validPayload, phone: '1112345678' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when phone is missing', async () => {
      const { phone: _phone, ...withoutPhone } = validPayload;
      const res = await postRegister(withoutPhone);
      expect(res.status).toBe(400);
    });

    it('should accept valid Argentine phone format (+54 9 11 1234-5678)', async () => {
      // This test verifies the VALID case doesn't get rejected at schema level
      // We mock Prisma so the request can proceed past validation
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockCreatedUser);
      mockPrisma.user.create.mockResolvedValue(mockCreatedUser);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

      const res = await postRegister(validPayload);
      expect(res.status).not.toBe(400);
    });
  });

  // ── DNI ────────────────────────────────────────────────────

  describe('dni', () => {
    it('should return 400 when DNI contains letters', async () => {
      const res = await postRegister({ ...validPayload, dni: 'ABCD1234' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const dniError = body.details.find((d) => d.field === 'dni');
        expect(dniError).toBeDefined();
      }
    });

    it('should return 400 when DNI has fewer than 7 digits', async () => {
      const res = await postRegister({ ...validPayload, dni: '123456' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when DNI has more than 8 digits', async () => {
      const res = await postRegister({ ...validPayload, dni: '123456789' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when DNI is missing', async () => {
      const { dni: _dni, ...withoutDni } = validPayload;
      const res = await postRegister(withoutDni);
      expect(res.status).toBe(400);
    });
  });

  // ── Password ───────────────────────────────────────────────

  describe('password', () => {
    it('should return 400 when password is shorter than 8 characters', async () => {
      const res = await postRegister({ ...validPayload, password: 'Abc1!' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const pwdError = body.details.find((d) => d.field === 'password');
        expect(pwdError).toBeDefined();
        expect(pwdError?.message).toMatch(/8/);
      }
    });

    it('should return 400 when password has no uppercase letter', async () => {
      const res = await postRegister({ ...validPayload, password: 'password1!' });

      expect(res.status).toBe(400);
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const pwdError = body.details.find((d) => d.field === 'password');
        expect(pwdError).toBeDefined();
        expect(pwdError?.message).toMatch(/uppercase/i);
      }
    });

    it('should return 400 when password has no number', async () => {
      const res = await postRegister({ ...validPayload, password: 'Password!' });

      expect(res.status).toBe(400);
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const pwdError = body.details.find((d) => d.field === 'password');
        expect(pwdError).toBeDefined();
        expect(pwdError?.message).toMatch(/number/i);
      }
    });

    it('should return 400 when password has no special character', async () => {
      const res = await postRegister({ ...validPayload, password: 'Password1' });

      expect(res.status).toBe(400);
      const body = res.body as { details?: Array<{ field: string; message: string }> };
      if (body.details) {
        const pwdError = body.details.find((d) => d.field === 'password');
        expect(pwdError).toBeDefined();
        expect(pwdError?.message).toMatch(/special/i);
      }
    });

    it('should return 400 when password is missing', async () => {
      const { password: _password, ...withoutPassword } = validPayload;
      const res = await postRegister(withoutPassword);
      expect(res.status).toBe(400);
    });
  });
});

// ============================================================
// SERVICE-LEVEL ERRORS
// ============================================================

describe('POST /api/auth/register — service errors', () => {
  beforeEach(() => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
  });

  it('should return 409 when email is already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockCreatedUser); // existing user

    const res = await postRegister(validPayload);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
});

// ============================================================
// SUCCESSFUL REGISTRATION — 201
// ============================================================

describe('POST /api/auth/register — success', () => {
  beforeEach(() => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)           // email not taken
      .mockResolvedValue(mockCreatedUser);   // getUserWithRole
    mockPrisma.user.create.mockResolvedValue(mockCreatedUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
  });

  it('should return 201 with user and tokens on valid registration', async () => {
    const res = await postRegister(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('tokens');
    expect(res.body.tokens).toHaveProperty('accessToken');
    expect(res.body.tokens).toHaveProperty('refreshToken');
    expect(typeof res.body.tokens.accessToken).toBe('string');
    expect(typeof res.body.tokens.refreshToken).toBe('string');
  });

  it('should return the registered user email in response', async () => {
    const res = await postRegister(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validPayload.email);
  });

  it('should NOT return the password hash in the response', async () => {
    const res = await postRegister(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should return role "client" for a regular registration', async () => {
    const res = await postRegister(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('client');
  });
});
