import { z } from 'zod';

export const createRequestSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  expiresAt: z.string().datetime(),
  categoryIds: z.array(z.coerce.number().int().positive()).min(1).max(3),
  media: z.array(
    z.object({
      mediaType: z.enum(['image', 'video']),
      mediaUrl: z.string().url(),
    })
  ).max(5).optional().default([]),
});

export const createProposalSchema = z.object({
  requestId: z.coerce.number().int().positive(),
  priceReference: z.coerce.number().positive(),
  scopeNotes: z.string().min(10).max(2000),
  proposedDate: z.string().date().optional(),
  proposedTime: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
});
