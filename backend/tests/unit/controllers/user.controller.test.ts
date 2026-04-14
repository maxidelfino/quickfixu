// tests/unit/controllers/user.controller.test.ts
// Unit tests for UserController - Simplified

describe('UserController', () => {
  describe('getProfile', () => {
    it('should be defined', () => {
      const { userController } = require('../../../src/controllers/user.controller');
      expect(userController).toBeDefined();
      expect(typeof userController.getProfile).toBe('function');
    });
  });

  describe('updateProfile', () => {
    it('should be defined', () => {
      const { userController } = require('../../../src/controllers/user.controller');
      expect(userController).toBeDefined();
      expect(typeof userController.updateProfile).toBe('function');
    });
  });

  describe('uploadPhoto', () => {
    it('should be defined', () => {
      const { userController } = require('../../../src/controllers/user.controller');
      expect(userController).toBeDefined();
      expect(typeof userController.uploadPhoto).toBe('function');
    });
  });

  describe('deleteAccount', () => {
    it('should be defined', () => {
      const { userController } = require('../../../src/controllers/user.controller');
      expect(userController).toBeDefined();
      expect(typeof userController.deleteAccount).toBe('function');
    });
  });
});
