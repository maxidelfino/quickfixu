// tests/unit/services/professional.service.test.ts
// Unit tests for ProfessionalService - Simplified

import prisma from '../../../src/config/database';
import { professionalService } from '../../../src/services/professional.service';
import { uploadService } from '../../../src/services/upload.service';

jest.mock('../../../src/services/upload.service', () => ({
  uploadService: {
    uploadCertification: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockPrisma = prisma as any;
const mockUploadService = uploadService as jest.Mocked<typeof uploadService>;

describe('ProfessionalService', () => {
  describe('getProfessionalProfile', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.getProfessionalProfile).toBe('function');
    });
  });

  describe('updateProfessionalProfile', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.updateProfessionalProfile).toBe('function');
    });
  });

  describe('updateCategories', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.updateCategories).toBe('function');
    });
  });

  describe('getPublicProfile', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.getPublicProfile).toBe('function');
    });
  });

  describe('searchByLocation', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.searchByLocation).toBe('function');
    });
  });

  describe('uploadCertification', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.uploadCertification).toBe('function');
    });
  });

  describe('getCertifications', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.getCertifications).toBe('function');
    });
  });

  describe('deleteCertification', () => {
    it('should be defined', () => {
      const { professionalService } = require('../../../src/services/professional.service');
      expect(professionalService).toBeDefined();
      expect(typeof professionalService.deleteCertification).toBe('function');
    });

    it('should delete the remote asset before soft deleting the certification', async () => {
      mockPrisma.professional.findUnique.mockResolvedValue({ id: 10, userId: 1 });
      mockPrisma.certification.findUnique.mockResolvedValue({
        id: 7,
        professionalId: 10,
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/quickfixu/certifications/10/license.pdf',
        status: 'pending',
        deletedAt: null,
      });
      mockPrisma.certification.update.mockResolvedValue({});

      await professionalService.deleteCertification(1, 7);

      expect(mockUploadService.deleteFile).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/raw/upload/v1/quickfixu/certifications/10/license.pdf'
      );
      expect(mockPrisma.certification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });
  });
});
