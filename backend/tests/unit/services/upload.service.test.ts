// tests/unit/services/upload.service.test.ts
// Unit tests for UploadService - Simplified

const mockDestroy = jest.fn().mockResolvedValue({ result: 'ok' });
const mockCloudinaryConfig = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: mockCloudinaryConfig,
    uploader: {
      destroy: mockDestroy,
      upload_stream: jest.fn(),
    },
  },
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalAllowMockCloudinary = process.env.ALLOW_MOCK_CLOUDINARY;
const originalCloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
const originalCloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const originalCloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

const imageFile = {
  buffer: Buffer.from('image'),
  mimetype: 'image/jpeg',
} as Express.Multer.File;

const loadUploadService = () => {
  jest.resetModules();
  return require('../../../src/services/upload.service').uploadService;
};

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;

  if (originalAllowMockCloudinary === undefined) {
    delete process.env.ALLOW_MOCK_CLOUDINARY;
  } else {
    process.env.ALLOW_MOCK_CLOUDINARY = originalAllowMockCloudinary;
  }

  if (originalCloudinaryCloudName === undefined) {
    delete process.env.CLOUDINARY_CLOUD_NAME;
  } else {
    process.env.CLOUDINARY_CLOUD_NAME = originalCloudinaryCloudName;
  }

  if (originalCloudinaryApiKey === undefined) {
    delete process.env.CLOUDINARY_API_KEY;
  } else {
    process.env.CLOUDINARY_API_KEY = originalCloudinaryApiKey;
  }

  if (originalCloudinaryApiSecret === undefined) {
    delete process.env.CLOUDINARY_API_SECRET;
  } else {
    process.env.CLOUDINARY_API_SECRET = originalCloudinaryApiSecret;
  }
});

describe('UploadService', () => {
  describe('uploadProfilePhoto', () => {
    it('should be defined', () => {
      const { uploadService } = require('../../../src/services/upload.service');
      expect(uploadService).toBeDefined();
      expect(typeof uploadService.uploadProfilePhoto).toBe('function');
    });

    it('should fail clearly when Cloudinary is not configured outside the explicit mock gate', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_CLOUDINARY;
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const uploadService = loadUploadService();

      await expect(uploadService.uploadProfilePhoto(imageFile, 1)).rejects.toThrow(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET or enable ALLOW_MOCK_CLOUDINARY=true in development/test.'
      );
    });

    it('should allow mock uploads only behind the explicit development/test gate', async () => {
      process.env.NODE_ENV = 'test';
      process.env.ALLOW_MOCK_CLOUDINARY = 'true';
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const uploadService = loadUploadService();

      await expect(uploadService.uploadProfilePhoto(imageFile, 42)).resolves.toContain(
        'https://via.placeholder.com/800x800.png?text=User+42'
      );
    });
  });

  describe('uploadCertification', () => {
    it('should be defined', () => {
      const { uploadService } = require('../../../src/services/upload.service');
      expect(uploadService).toBeDefined();
      expect(typeof uploadService.uploadCertification).toBe('function');
    });
  });

  describe('deleteFile', () => {
    it('should be defined', () => {
      const { uploadService } = require('../../../src/services/upload.service');
      expect(uploadService).toBeDefined();
      expect(typeof uploadService.deleteFile).toBe('function');
    });

    it('should delete raw assets using the raw resource type', async () => {
      process.env.NODE_ENV = 'test';
      process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
      process.env.CLOUDINARY_API_KEY = 'key';
      process.env.CLOUDINARY_API_SECRET = 'secret';

      const uploadService = loadUploadService();

      await uploadService.deleteFile(
        'https://res.cloudinary.com/demo/raw/upload/v1710000000/quickfixu/certifications/10/license.pdf'
      );

      expect(mockDestroy).toHaveBeenCalledWith(
        'quickfixu/certifications/10/license',
        { resource_type: 'raw' }
      );
    });
  });
});
