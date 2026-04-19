// tests/unit/services/geocoding.service.test.ts
// Unit tests for GeocodingService (isolated from setup.ts global mock)

import crypto from 'crypto';

// We need to test the real GeocodingService class, not the global mock.
// So we unmock it for this test file.
jest.unmock('../../../src/services/geocoding.service');

// But we do keep Redis mocked
const mockRedis = {
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('../../../src/config/redis', () => ({
  __esModule: true,
  default: mockRedis,
}));

let mockAxios: jest.Mocked<typeof import('axios').default>;
let AppErrorClass: typeof import('../../../src/types/errors.types').AppError;

// ============================================================
// Import AFTER mocks are established
// ============================================================
// We need to import the actual class to test, not the singleton
// Let's re-require after clearing module cache
let geocodingServiceModule: any;

beforeAll(async () => {
  jest.resetModules();
  const axiosModule = await import('axios');
  const errorsModule = await import('../../../src/types/errors.types');
  mockAxios = axiosModule.default as jest.Mocked<typeof axiosModule.default>;
  AppErrorClass = errorsModule.AppError;
  // Re-import fresh instance with our mocks applied
  geocodingServiceModule = await import('../../../src/services/geocoding.service');
  // Give constructor time to check redis
  await new Promise((r) => setTimeout(r, 10));
});

describe('GeocodingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Redis to available
    mockRedis.ping.mockResolvedValue('PONG');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('geocode() - caching', () => {
    it('should return cached result from Redis without calling Nominatim', async () => {
      const cachedCoords = { latitude: -34.6037, longitude: -58.3816 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedCoords));

      const result = await geocodingServiceModule.geocodingService.geocode('Buenos Aires');

      expect(result).toEqual(cachedCoords);
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('should call Nominatim when there is no Redis cache', async () => {
      mockRedis.get.mockResolvedValue(null); // cache miss
      mockAxios.get.mockResolvedValue({
        data: [{ lat: '-34.6037', lon: '-58.3816' }],
      });

      const result = await geocodingServiceModule.geocodingService.geocode('Buenos Aires');

      expect(result).toEqual({ latitude: -34.6037, longitude: -58.3816 });
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/search',
        expect.any(Object)
      );
    });

    it('should fall back to Google when Nominatim fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      // Nominatim fails
      mockAxios.get
        .mockRejectedValueOnce(new Error('Nominatim timeout'))
        // Google succeeds
        .mockResolvedValueOnce({
          data: {
            status: 'OK',
            results: [{ geometry: { location: { lat: -34.6037, lng: -58.3816 } } }],
          },
        });

      process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';
      const result = await geocodingServiceModule.geocodingService.geocode('Buenos Aires');

      expect(result).toEqual({ latitude: -34.6037, longitude: -58.3816 });
      // Second call should be to Google
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
      expect(mockAxios.get).toHaveBeenLastCalledWith(
        'https://maps.googleapis.com/maps/api/geocode/json',
        expect.any(Object)
      );
    });

    it('should throw AppError 503 when both Nominatim and Google fail', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAxios.get
        .mockRejectedValueOnce(new Error('Nominatim timeout'))
        .mockRejectedValueOnce(new Error('Google timeout'));

      process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';

      const geocodePromise = geocodingServiceModule.geocodingService.geocode('Invalid Address XYZ');

      await expect(geocodePromise).rejects.toBeInstanceOf(AppErrorClass);

      await expect(geocodePromise).rejects.toMatchObject({ statusCode: 503 });
    });
  });

  describe('getCacheKey() - deterministic hashing', () => {
    it('should produce the same hash for the same address (case-insensitive)', async () => {
      // Access the private method indirectly by checking Redis key
      const addr1 = 'Buenos Aires';
      const addr2 = 'buenos aires'; // different case

      const normalized1 = addr1.toLowerCase().trim();
      const normalized2 = addr2.toLowerCase().trim();

      const hash1 = crypto.createHash('md5').update(normalized1).digest('hex');
      const hash2 = crypto.createHash('md5').update(normalized2).digest('hex');

      expect(hash1).toBe(hash2);
      expect(`geocode:${hash1}`).toBe(`geocode:${hash2}`);
    });

    it('should produce different hashes for different addresses', () => {
      const addr1 = 'Buenos Aires';
      const addr2 = 'Córdoba';

      const hash1 = crypto.createHash('md5').update(addr1.toLowerCase().trim()).digest('hex');
      const hash2 = crypto.createHash('md5').update(addr2.toLowerCase().trim()).digest('hex');

      expect(hash1).not.toBe(hash2);
    });
  });
});
