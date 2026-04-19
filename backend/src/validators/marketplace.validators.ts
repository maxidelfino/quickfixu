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

const appointmentCoordinationFields = {
  location: z.string().min(3).max(500).optional(),
  instructions: z.string().min(3).max(2000).optional(),
  notes: z.string().min(3).max(2000).optional(),
};

export const scheduleAppointmentSchema = z.object({
  scheduledDate: z.string().date(),
  scheduledTime: z.string().datetime(),
  ...appointmentCoordinationFields,
});

export const updateAppointmentSchema = scheduleAppointmentSchema;

export const cancelAppointmentSchema = z.object({
  reason: z.string().min(10).max(1000),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000).optional(),
});
