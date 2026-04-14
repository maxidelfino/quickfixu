// tests/unit/controllers/auth.controller.test.ts
// Unit tests for AuthController - Simplified

describe('AuthController', () => {
  describe('register', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.register).toBe('function');
    });
  });

  describe('login', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.login).toBe('function');
    });
  });

  describe('oauthGoogle', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.oauthGoogle).toBe('function');
    });
  });

  describe('oauthFacebook', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.oauthFacebook).toBe('function');
    });
  });

  describe('refresh', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.refresh).toBe('function');
    });
  });

  describe('logout', () => {
    it('should be defined', () => {
      const { authController } = require('../../../src/controllers/auth.controller');
      expect(authController).toBeDefined();
      expect(typeof authController.logout).toBe('function');
    });
  });
});
