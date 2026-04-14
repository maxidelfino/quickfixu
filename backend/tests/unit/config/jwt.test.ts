// tests/unit/config/jwt.test.ts
// Unit tests for JWT sign/verify utilities

import { signToken, verifyToken } from '../../../src/config/jwt';

describe('JWT Utilities', () => {
  describe('signToken()', () => {
    it('should return a valid JWT string', () => {
      const token = signToken(42);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should embed userId in the token payload', () => {
      const userId = 99;
      const token = signToken(userId);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(userId);
    });
  });

  describe('verifyToken()', () => {
    it('should decode a valid token and return the payload', () => {
      const userId = 7;
      const token = signToken(userId);
      const payload = verifyToken(token);
      expect(payload).toMatchObject({ userId });
    });

    it('should throw on an invalid signature', () => {
      const jwt = require('jsonwebtoken');
      // Sign with a different secret
      const badToken = jwt.sign({ userId: 1 }, 'wrong-secret');
      expect(() => verifyToken(badToken)).toThrow();
    });

    it('should throw TokenExpiredError on an expired token', () => {
      const jwt = require('jsonwebtoken');
      const TEST_SECRET = 'test-secret-key-for-unit-tests';
      // Create a token that expired 1 second ago
      const expiredToken = jwt.sign({ userId: 1 }, TEST_SECRET, { expiresIn: -1 });
      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });
});
