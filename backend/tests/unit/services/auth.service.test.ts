// tests/unit/services/auth.service.test.ts
// Unit tests for AuthService

import { authService } from '../../../src/services/auth.service';
import prisma from '../../../src/config/database';
import { geocodingService } from '../../../src/services/geocoding.service';
import { AppError } from '../../../src/types/errors.types';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import axios from 'axios';

const mockPrisma = prisma as any;
const mockGeocodingService = geocodingService as jest.Mocked<typeof geocodingService>;
const mockAxios = axios as jest.Mocked<typeof axios>;

// ============================================================
// TEST FIXTURES
// ============================================================

const baseRegisterDto = {
  fullName: 'Juan Pérez',
  email: 'juan@example.com',
  password: 'Password1!',
  phone: '+54 9 11 1234-5678',
  dni: '12345678',
  address: 'Av. Corrientes 1234, Buenos Aires',
};

const professionalRegisterDto = {
  ...baseRegisterDto,
  email: 'pro@example.com',
  yearsExperience: 5,
  description: 'Experienced plumber with 5 years of experience',
  categoryIds: [1, 2],
};

const mockUser = {
  id: 1,
  fullName: 'Juan Pérez',
  email: 'juan@example.com',
  passwordHash: null as string | null,
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
};

const mockProfessionalUser = {
  ...mockUser,
  id: 2,
  email: 'pro@example.com',
  professional: {
    id: 10,
    userId: 2,
    yearsExperience: 5,
    description: 'Experienced plumber',
    categories: [{ category: { id: 1, name: 'Plomería', slug: 'plomeria', icon: '🔧' } }],
    certifications: [],
  },
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Mock prisma.$transaction to execute the callback immediately
 */
function setupTransactionMock() {
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
}

// ============================================================
// register() TESTS
// ============================================================

describe('AuthService.register()', () => {
  beforeEach(() => {
    setupTransactionMock();
  });

  it('should register a client successfully and return tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
    mockPrisma.user.create.mockResolvedValue(mockUser);
    // getUserWithRole call (second findUnique in private method)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // check existing user
      .mockResolvedValue(mockUser); // getUserWithRole

    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const result = await authService.register(baseRegisterDto);

    expect(result).toHaveProperty('tokens');
    expect(result.tokens).toHaveProperty('accessToken');
    expect(result.tokens).toHaveProperty('refreshToken');
    expect(result.user.role).toBe('client');
  });

  it('should register a professional with categories successfully', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no existing user
    mockPrisma.user.create.mockResolvedValue({ ...mockUser, id: 2 });
    mockPrisma.professional.create.mockResolvedValue({ id: 10, userId: 2 });
    mockPrisma.professionalCategory.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.user.findUnique.mockResolvedValue(mockProfessionalUser); // getUserWithRole
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const result = await authService.register(professionalRegisterDto);

    expect(result.user.role).toBe('professional');
    expect(result.user.professional).toBeDefined();
    expect(mockPrisma.professional.create).toHaveBeenCalled();
    expect(mockPrisma.professionalCategory.createMany).toHaveBeenCalled();
  });

  it('should throw AppError 409 when email is already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser); // email exists

    await expect(authService.register(baseRegisterDto)).rejects.toThrow(
      new AppError(409, 'Email already registered')
    );
  });
});

// ============================================================
// login() TESTS
// ============================================================

describe('AuthService.login()', () => {
  it('should login successfully with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 12);
    const userWithHash = { ...mockUser, passwordHash };

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(userWithHash) // login lookup
      .mockResolvedValue(mockUser); // getUserWithRole
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const result = await authService.login('juan@example.com', 'Password1!');

    expect(result).toHaveProperty('tokens');
    expect(result.user.email).toBe('juan@example.com');
  });

  it('should throw AppError 401 for invalid password', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword1!', 12);
    const userWithHash = { ...mockUser, passwordHash };

    mockPrisma.user.findUnique.mockResolvedValue(userWithHash);

    await expect(authService.login('juan@example.com', 'WrongPassword1!')).rejects.toThrow(
      new AppError(401, 'Invalid credentials')
    );
  });

  it('should throw AppError 401 when user does not exist (and still run bcrypt for timing protection)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // no user found
    const bcryptSpy = jest.spyOn(bcrypt, 'compare');

    await expect(authService.login('nonexistent@example.com', 'Password1!')).rejects.toThrow(
      new AppError(401, 'Invalid credentials')
    );

    // Timing attack protection: bcrypt.compare must always be called
    expect(bcryptSpy).toHaveBeenCalled();
  });

  it('should always call bcrypt.compare even when user is not found (timing attack protection)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const bcryptSpy = jest.spyOn(bcrypt, 'compare');

    try {
      await authService.login('nobody@example.com', 'anypassword');
    } catch {
      // expected to throw
    }

    expect(bcryptSpy).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// oauthGoogle()/oauthFacebook() TESTS
// ============================================================

describe('AuthService OAuth mock token gating', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowMockOauthTokens = process.env.ALLOW_MOCK_OAUTH_TOKENS;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientIds = process.env.GOOGLE_CLIENT_IDS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowMockOauthTokens === undefined) {
      delete process.env.ALLOW_MOCK_OAUTH_TOKENS;
    } else {
      process.env.ALLOW_MOCK_OAUTH_TOKENS = originalAllowMockOauthTokens;
    }

    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }

    if (originalGoogleClientIds === undefined) {
      delete process.env.GOOGLE_CLIENT_IDS;
      return;
    }

    process.env.GOOGLE_CLIENT_IDS = originalGoogleClientIds;
  });

  it('should fail closed when no Google audience is configured', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_IDS;

    await expect(
      authService.oauthGoogle({ idToken: 'mock_google_user_user@example.com_Test User' })
    ).rejects.toThrow(
      new AppError(
        500,
        'Google OAuth is not configured. Set GOOGLE_CLIENT_IDS and/or GOOGLE_CLIENT_ID to validate token audiences.'
      )
    );
  });

  it('should accept a Google token whose audience is in GOOGLE_CLIENT_IDS', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_IDS = 'web-client-id, android-client-id, ios-client-id';

    mockAxios.get.mockResolvedValue({
      data: {
        aud: 'android-client-id',
        sub: 'google-user-id',
        email: 'google@example.com',
        name: 'Google User',
        picture: 'https://example.com/photo.jpg',
      },
    });

    const mockGoogleUser = {
      ...mockUser,
      authProvider: 'google',
      oauthId: 'google-user-id',
      email: 'google@example.com',
      fullName: 'Google User',
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(mockGoogleUser);
    mockPrisma.user.create.mockResolvedValue(mockGoogleUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const result = await authService.oauthGoogle({ idToken: 'real-google-token' });

    expect(result.user.email).toBe('google@example.com');
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authProvider: 'google',
          oauthId: 'google-user-id',
        }),
      })
    );
  });

  it('should reject mock Google tokens outside the explicit gate', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'expected-google-client-id';
    delete process.env.GOOGLE_CLIENT_IDS;
    delete process.env.ALLOW_MOCK_OAUTH_TOKENS;
    mockAxios.get.mockRejectedValue({ response: { status: 400 } });

    await expect(
      authService.oauthGoogle({ idToken: 'mock_google_user_user@example.com_Test User' })
    ).rejects.toThrow(new AppError(401, 'Invalid Google authentication token'));
  });

  it('should allow mock Facebook tokens in test runtime', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCK_OAUTH_TOKENS;

    mockAxios.get.mockRejectedValue(new Error('mocked Facebook verification failure'));
    const mockFacebookUser = {
      ...mockUser,
      authProvider: 'facebook',
      oauthId: 'user',
      email: 'user@example.com',
      fullName: 'Test User',
    };

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(mockFacebookUser);
    mockPrisma.user.create.mockResolvedValue(mockFacebookUser);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });

    const result = await authService.oauthFacebook({
      accessToken: 'mock_facebook_user_user@example.com_Test User',
    });

    expect(result.user.email).toBe('user@example.com');
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authProvider: 'facebook',
          oauthId: 'user',
        }),
      })
    );
  });
});

// ============================================================
// refreshAccessToken() TESTS
// ============================================================

describe('AuthService.refreshAccessToken()', () => {
  const rawToken = 'some-uuid-token-value';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  it('should return new access and refresh tokens on success (rotation)', async () => {
    const storedToken = {
      id: 1,
      userId: 1,
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // future
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);
    mockPrisma.refreshToken.update.mockResolvedValue({ ...storedToken, isRevoked: true });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 2 });

    const result = await authService.refreshAccessToken(rawToken);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    // Old token should be revoked
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isRevoked: true } })
    );
  });

  it('should throw AppError 401 when token does not exist', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(authService.refreshAccessToken(rawToken)).rejects.toThrow(
      new AppError(401, 'Invalid refresh token')
    );
  });

  it('should throw AppError 401 when token is expired', async () => {
    const expiredToken = {
      id: 1,
      userId: 1,
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // in the past
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

    await expect(authService.refreshAccessToken(rawToken)).rejects.toThrow(
      new AppError(401, 'Refresh token expired. Please login again.')
    );
  });

  it('should revoke ALL user tokens when a revoked token is reused (reuse detection)', async () => {
    const revokedToken = {
      id: 1,
      userId: 42,
      tokenHash,
      isRevoked: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedToken);
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    await expect(authService.refreshAccessToken(rawToken)).rejects.toThrow(
      new AppError(401, 'Token reuse detected. All sessions invalidated for security.')
    );

    // All tokens for this user should be revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      data: { isRevoked: true },
    });
  });
});

// ============================================================
// logout() TESTS
// ============================================================

describe('AuthService.logout()', () => {
  it('should revoke the provided refresh token', async () => {
    const rawToken = 'some-logout-token';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await authService.logout(rawToken);

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  });

  it('should be idempotent: not throw if token does not exist (already revoked)', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 }); // 0 rows affected

    await expect(authService.logout('nonexistent-token')).resolves.not.toThrow();
  });
});
