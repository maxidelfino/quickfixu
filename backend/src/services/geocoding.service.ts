// src/services/geocoding.service.ts
// Geocoding service - Hybrid Nominatim (free) + Google Geocoding (fallback)

import axios from 'axios';
import crypto from 'crypto';
import redis from '../config/redis';
import { AppError } from '../types/errors.types';

interface Coordinates {
  latitude: number;
  longitude: number;
}

class GeocodingService {
  private redisAvailable: boolean = true;

  constructor() {
    // Check Redis availability on startup
    this.checkRedisConnection();
  }

  /**
   * Check if Redis is available
   */
  private async checkRedisConnection(): Promise<void> {
    try {
      await redis.ping();
      this.redisAvailable = true;
    } catch (error) {
      console.warn(
        '⚠️  Redis not available. Geocoding cache will be disabled.'
      );
      this.redisAvailable = false;
    }
  }

  /**
   * Geocode address to lat/lng coordinates
   * 1. Check Redis cache first (90-day TTL)
   * 2. Try Nominatim (OpenStreetMap) - free, rate-limited
   * 3. Fallback to Google Geocoding API if Nominatim fails
   * 4. Cache result for 90 days
   */
  async geocode(address: string): Promise<Coordinates> {
    // Check cache first
    const cached = await this.getCachedGeocode(address);
    if (cached) {
      console.log(`📍 Geocode cache hit: ${address}`);
      return cached;
    }

    // Try Nominatim first (free)
    let coords: Coordinates;
    try {
      coords = await this.geocodeNominatim(address);
      await this.cacheGeocode(address, coords);
      return coords;
    } catch (error) {
      console.warn(
        '⚠️  Nominatim geocoding failed, falling back to Google:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Fallback to Google Geocoding API
    try {
      coords = await this.geocodeGoogle(address);
      await this.cacheGeocode(address, coords);
      return coords;
    } catch (error) {
      console.error(
        '❌ Both Nominatim and Google geocoding failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new AppError(
        503,
        'Geocoding service temporarily unavailable. Please try again later.'
      );
    }
  }

  /**
   * Geocode with Nominatim (OpenStreetMap)
   * Free service with rate limiting (1 request/second)
   */
  private async geocodeNominatim(address: string): Promise<Coordinates> {
    const userAgent = process.env.NOMINATIM_USER_AGENT || 'QuickFixU/1.0 (contact@quickfixu.com)';

    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'ar', // Prioritize Argentina
        },
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'es-ES,es',
        },
        timeout: 5000,
      }
    );

    if (!response.data || response.data.length === 0) {
      throw new Error('No results from Nominatim');
    }

    const result = response.data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  }

  /**
   * Geocode with Google Geocoding API
   * Paid service, more reliable
   */
  private async geocodeGoogle(address: string): Promise<Coordinates> {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

    if (!apiKey) {
      throw new Error('Google Geocoding API key not configured');
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: apiKey,
          region: 'ar', // Prioritize Argentina
          language: 'es',
        },
        timeout: 5000,
      }
    );

    if (response.data.status !== 'OK') {
      if (response.data.status === 'ZERO_RESULTS') {
        throw new Error('No results from Google Geocoding');
      }
      throw new Error(`Google Geocoding failed: ${response.data.status}`);
    }

    if (!response.data.results.length) {
      throw new Error('No results from Google Geocoding');
    }

    const location = response.data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  /**
   * Get cached geocoding result from Redis
   * Returns null if cache miss or Redis unavailable
   */
  async getCachedGeocode(address: string): Promise<Coordinates | null> {
    if (!this.redisAvailable) {
      return null;
    }

    try {
      const key = this.getCacheKey(address);
      const cached = await redis.get(key);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('⚠️  Redis cache get failed:', error instanceof Error ? error.message : 'Unknown error');
      // Don't throw - just return null and continue
    }

    return null;
  }

  /**
   * Cache geocoding result in Redis (90-day TTL)
   * Silently fails if Redis unavailable
   */
  async cacheGeocode(
    address: string,
    coords: Coordinates
  ): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }

    try {
      const key = this.getCacheKey(address);
      const ttl = 90 * 24 * 60 * 60; // 90 days in seconds
      await redis.set(key, JSON.stringify(coords), 'EX', ttl);
    } catch (error) {
      console.warn(
        '⚠️  Redis cache set failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      // Don't throw - cache failure shouldn't block geocoding
    }
  }

  /**
   * Generate cache key from address (MD5 hash)
   * Normalizes address to lowercase before hashing
   */
  private getCacheKey(address: string): string {
    const normalized = address.toLowerCase().trim();
    const hash = crypto
      .createHash('md5')
      .update(normalized)
      .digest('hex');
    return `geocode:${hash}`;
  }
}

export const geocodingService = new GeocodingService();
