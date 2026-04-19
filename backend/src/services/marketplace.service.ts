import {
  AppointmentCancellationActor,
  calculateNextRatingSummary,
  resolveAppointmentCancellationState,
  resolveAppointmentCompletionState,
  resolveAppointmentSchedulingState,
  resolveAppointmentStartState,
  resolveReviewEligibility,
} from '../domain/marketplace';
import { AppError } from '../types/errors.types';
import { marketplaceRepository } from '../repositories/marketplace.repository';

interface AuthenticatedActor {
  id: number;
  role: 'client' | 'professional';
}

interface CreateRequestDto {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  expiresAt: string;
  categoryIds: number[];
  media: Array<{ mediaType: 'image' | 'video'; mediaUrl: string }>;
}

interface CreateProposalDto {
  requestId: number;
  priceReference: number;
  scopeNotes: string;
  proposedDate?: string;
  proposedTime?: string;
  expiresAt: string;
}

interface AppointmentScheduleDto {
  scheduledDate: string;
  scheduledTime: string;
  location?: string;
  instructions?: string;
  notes?: string;
}

interface CancelAppointmentDto {
  reason: string;
}

interface CreateReviewDto {
  rating: number;
  comment?: string;
}

const REQUEST_OPEN_STATUSES = new Set(['published', 'receiving_proposals']);

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function mapRequest(request: any) {
  return {
    id: request.id,
    userId: request.userId,
    title: request.title,
    description: request.description,
    latitude: toNumber(request.latitude),
    longitude: toNumber(request.longitude),
    status: request.status,
    expiresAt: request.expiresAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    proposalCount: request.proposals?.length ?? 0,
    user: request.user,
    categories: (request.categories ?? []).map((item: any) => item.category),
    media: request.media ?? [],
  };
}

function mapProposal(proposal: any) {
  return {
    id: proposal.id,
    requestId: proposal.requestId,
    professionalId: proposal.professionalId,
    priceReference: toNumber(proposal.priceReference),
    scopeNotes: proposal.scopeNotes,
    proposedDate: proposal.proposedDate,
    proposedTime: proposal.proposedTime,
    status: proposal.status,
    expiresAt: proposal.expiresAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    request: proposal.request,
    professional: proposal.professional,
    appointmentId: proposal.appointment?.id ?? null,
  };
}

function mapAppointment(appointment: any) {
  return {
    id: appointment.id,
    requestId: appointment.requestId,
    proposalId: appointment.proposalId,
    status: appointment.status,
    scheduledDate: appointment.scheduledDate,
    scheduledTime: appointment.scheduledTime,
    location: appointment.location ?? null,
    instructions: appointment.instructions ?? null,
    notes: appointment.notes ?? null,
    rescheduledCount: appointment.rescheduledCount,
    cancellationReason: appointment.cancellationReason,
    cancelledBy: appointment.cancelledBy,
    clientConfirmedCompletionAt: appointment.clientConfirmedCompletionAt,
    professionalConfirmedCompletionAt: appointment.professionalConfirmedCompletionAt,
    completedAt: appointment.completedAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    request: appointment.request,
    proposal: appointment.proposal,
    requestSummary: appointment.request
      ? {
          id: appointment.request.id,
          title: appointment.request.title,
          status: appointment.request.status,
          expiresAt: appointment.request.expiresAt ?? null,
          client: appointment.request.user
            ? {
                id: appointment.request.user.id,
                fullName: appointment.request.user.fullName,
              }
            : null,
        }
      : null,
    proposalSummary: appointment.proposal
      ? {
          id: appointment.proposal.id,
          status: appointment.proposal.status,
          priceReference: toNumber(appointment.proposal.priceReference),
          scopeNotes: appointment.proposal.scopeNotes,
          proposedDate: appointment.proposal.proposedDate ?? null,
          proposedTime: appointment.proposal.proposedTime ?? null,
          professional: appointment.proposal.professional
            ? {
                id: appointment.proposal.professional.id,
                fullName: appointment.proposal.professional.user?.fullName ?? null,
                rating: appointment.proposal.professional.user?.rating != null
                  ? toNumber(appointment.proposal.professional.user.rating)
                  : null,
                ratingCount: appointment.proposal.professional.user?.ratingCount ?? null,
              }
            : null,
        }
      : null,
  };
}

function mapReview(review: any) {
  return {
    id: review.id,
    appointmentId: review.appointmentId,
    reviewerUserId: review.reviewerUserId,
    reviewedUserId: review.reviewedUserId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reviewer: review.reviewer,
    reviewed: review.reviewed,
  };
}

function appointmentParticipantRole(appointment: any, actor: AuthenticatedActor): AppointmentCancellationActor {
  if (appointment.request.userId === actor.id) {
    return 'client';
  }

  if (appointment.proposal.professional.user.id === actor.id) {
    return 'professional';
  }

  throw new AppError(403, 'You are not part of this appointment');
}

function parseAppointmentSchedule(input: AppointmentScheduleDto) {
  return {
    scheduledDate: new Date(input.scheduledDate),
    scheduledTime: new Date(input.scheduledTime),
    location: input.location ?? null,
    instructions: input.instructions ?? null,
    notes: input.notes ?? null,
  };
}

class MarketplaceService {
  async createRequest(userId: number, input: CreateRequestDto) {
    const expiresAt = new Date(input.expiresAt);

    if (expiresAt <= new Date()) {
      throw new AppError(400, 'Request expiration must be in the future');
    }

    const request = await marketplaceRepository.createRequest({
      userId,
      title: input.title,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      expiresAt,
      categoryIds: input.categoryIds,
      media: input.media ?? [],
    });

    return mapRequest(request);
  }

  async listRequests(actor: AuthenticatedActor) {
    const requests = actor.role === 'client'
      ? await marketplaceRepository.listRequestsForClient(actor.id)
      : await marketplaceRepository.listRequestsForProfessional();

    return requests.map(mapRequest);
  }

  async getRequestById(actor: AuthenticatedActor, requestId: number) {
    const request = await marketplaceRepository.getRequestById(requestId);

    if (!request || request.deletedAt) {
      throw new AppError(404, 'Request not found');
    }

    if (actor.role === 'client' && request.userId !== actor.id) {
      throw new AppError(403, 'You cannot access this request');
    }

    return mapRequest(request);
  }

  async createProposal(userId: number, input: CreateProposalDto) {
    const request = await marketplaceRepository.getRequestById(input.requestId);

    if (!request || request.deletedAt) {
      throw new AppError(404, 'Request not found');
    }

    if (!REQUEST_OPEN_STATUSES.has(request.status)) {
      throw new AppError(409, 'Request is not open for proposals');
    }

    const professional = await marketplaceRepository.getProfessionalByUserId(userId);

    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= new Date()) {
      throw new AppError(400, 'Proposal expiration must be in the future');
    }

    const proposal = await marketplaceRepository.createProposal({
      requestId: input.requestId,
      professionalId: professional.id,
      priceReference: input.priceReference,
      scopeNotes: input.scopeNotes,
      proposedDate: input.proposedDate ? new Date(input.proposedDate) : null,
      proposedTime: input.proposedTime ? new Date(input.proposedTime) : null,
      expiresAt,
    });

    return mapProposal(proposal);
  }

  async listRequestProposals(actor: AuthenticatedActor, requestId: number) {
    const request = await marketplaceRepository.getRequestById(requestId);

    if (!request || request.deletedAt) {
      throw new AppError(404, 'Request not found');
    }

    if (actor.role === 'client') {
      if (request.userId !== actor.id) {
        throw new AppError(403, 'You cannot access proposals for this request');
      }

      const proposals = await marketplaceRepository.listProposalsByRequest(requestId);
      return proposals.map(mapProposal);
    }

    const professional = await marketplaceRepository.getProfessionalByUserId(actor.id);
    if (!professional) {
      throw new AppError(404, 'Professional profile not found');
    }

    const proposals = await marketplaceRepository.listProposalsByRequest(requestId, professional.id);
    return proposals.map(mapProposal);
  }

  async getProposalById(actor: AuthenticatedActor, proposalId: number) {
    const proposal = await marketplaceRepository.getProposalById(proposalId);

    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }

    if (actor.role === 'client' && proposal.request.userId !== actor.id) {
      throw new AppError(403, 'You cannot access this proposal');
    }

    if (actor.role === 'professional' && proposal.professional.user.id !== actor.id) {
      throw new AppError(403, 'You cannot access this proposal');
    }

    return mapProposal(proposal);
  }

  async acceptProposal(userId: number, proposalId: number) {
    const proposal = await marketplaceRepository.getProposalById(proposalId);

    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }

    if (proposal.request.userId !== userId) {
      throw new AppError(403, 'Only the request owner can accept this proposal');
    }

    if (!['sent', 'viewed'].includes(proposal.status)) {
      throw new AppError(409, 'Proposal cannot be accepted in its current state');
    }

    if (proposal.appointment) {
      throw new AppError(409, 'Proposal already has an appointment');
    }

    const appointment = await marketplaceRepository.acceptProposal(
      proposal.id,
      proposal.requestId,
      proposal.proposedDate,
      proposal.proposedTime
    );

    return mapAppointment(appointment);
  }

  async getAppointmentById(actor: AuthenticatedActor, appointmentId: number) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointmentParticipantRole(appointment, actor);

    return mapAppointment(appointment);
  }

  async confirmAppointmentCompletion(actor: AuthenticatedActor, appointmentId: number) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    if (appointment.status === 'cancelled') {
      throw new AppError(409, 'Cancelled appointments cannot be completed');
    }

    if (!['in_progress', 'pending_completion_confirmation'].includes(appointment.status)) {
      throw new AppError(409, 'Appointment must be in progress before completion confirmation');
    }

    const now = new Date();
    let clientConfirmedCompletionAt = appointment.clientConfirmedCompletionAt;
    let professionalConfirmedCompletionAt = appointment.professionalConfirmedCompletionAt;

    if (appointment.request.userId === actor.id) {
      clientConfirmedCompletionAt = clientConfirmedCompletionAt ?? now;
    } else if (appointment.proposal.professional.user.id === actor.id) {
      professionalConfirmedCompletionAt = professionalConfirmedCompletionAt ?? now;
    } else {
      throw new AppError(403, 'You are not part of this appointment');
    }

    const completion = resolveAppointmentCompletionState({
      clientConfirmedCompletionAt,
      professionalConfirmedCompletionAt,
    });

    const updatedAppointment = await marketplaceRepository.updateAppointmentCompletion(
      appointmentId,
      {
        clientConfirmedCompletionAt,
        professionalConfirmedCompletionAt,
        status: completion.status,
        completedAt: completion.completedAt,
      },
      completion.status === 'completed',
      appointment.requestId
    );

    return mapAppointment(updatedAppointment);
  }

  async scheduleAppointment(actor: AuthenticatedActor, appointmentId: number, input: AppointmentScheduleDto) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointmentParticipantRole(appointment, actor);

    const transition = resolveAppointmentSchedulingState({
      currentStatus: appointment.status,
      rescheduledCount: appointment.rescheduledCount,
      mode: 'initial',
    });
    const schedule = parseAppointmentSchedule(input);

    const updatedAppointment = await marketplaceRepository.updateAppointmentLifecycle(
      appointmentId,
      {
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        location: schedule.location,
        instructions: schedule.instructions,
        notes: schedule.notes,
        status: transition.status,
        rescheduledCount: transition.rescheduledCount,
      },
      appointment.requestId,
      'in_coordination'
    );

    return mapAppointment(updatedAppointment);
  }

  async updateAppointment(actor: AuthenticatedActor, appointmentId: number, input: AppointmentScheduleDto) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointmentParticipantRole(appointment, actor);

    const transition = resolveAppointmentSchedulingState({
      currentStatus: appointment.status,
      rescheduledCount: appointment.rescheduledCount,
      mode: 'update',
    });
    const schedule = parseAppointmentSchedule(input);

    const updatedAppointment = await marketplaceRepository.updateAppointmentLifecycle(
      appointmentId,
      {
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        location: schedule.location,
        instructions: schedule.instructions,
        notes: schedule.notes,
        status: transition.status,
        rescheduledCount: transition.rescheduledCount,
      },
      appointment.requestId,
      'in_coordination'
    );

    return mapAppointment(updatedAppointment);
  }

  async startAppointment(actor: AuthenticatedActor, appointmentId: number) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointmentParticipantRole(appointment, actor);

    const transition = resolveAppointmentStartState(appointment.status);

    const updatedAppointment = await marketplaceRepository.updateAppointmentLifecycle(
      appointmentId,
      { status: transition.status },
      appointment.requestId,
      'in_coordination'
    );

    return mapAppointment(updatedAppointment);
  }

  async cancelAppointment(actor: AuthenticatedActor, appointmentId: number, input: CancelAppointmentDto) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    const cancelledBy = appointmentParticipantRole(appointment, actor);
    const transition = resolveAppointmentCancellationState(appointment.status);

    const updatedAppointment = await marketplaceRepository.updateAppointmentLifecycle(
      appointmentId,
      {
        status: transition.appointmentStatus,
        cancellationReason: input.reason,
        cancelledBy,
      },
      appointment.requestId,
      transition.requestStatus
    );

    return mapAppointment(updatedAppointment);
  }

  async createAppointmentReview(actor: AuthenticatedActor, appointmentId: number, input: CreateReviewDto) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    const eligibility = resolveReviewEligibility({
      appointmentStatus: appointment.status,
      completedAt: appointment.completedAt,
    });

    if (!eligibility.eligible) {
      throw new AppError(409, eligibility.reason!);
    }

    const participantRole = appointmentParticipantRole(appointment, actor);
    const reviewedUser = participantRole === 'client'
      ? appointment.proposal.professional.user
      : appointment.request.user;

    const existingReview = await marketplaceRepository.getReviewByAppointmentAndReviewer(appointmentId, actor.id);
    if (existingReview) {
      throw new AppError(409, 'You have already reviewed this appointment');
    }

    const ratingSummary = calculateNextRatingSummary({
      currentRating: toNumber(reviewedUser.rating),
      currentRatingCount: reviewedUser.ratingCount,
      newRating: input.rating,
    });

    const review = await marketplaceRepository.createReview({
      appointmentId,
      reviewerUserId: actor.id,
      reviewedUserId: reviewedUser.id,
      rating: input.rating,
      comment: input.comment ?? null,
      reviewedRating: ratingSummary.rating,
      reviewedRatingCount: ratingSummary.ratingCount,
    });

    return mapReview(review);
  }

  async listAppointmentReviews(actor: AuthenticatedActor, appointmentId: number) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    appointmentParticipantRole(appointment, actor);

    const reviews = await marketplaceRepository.listAppointmentReviews(appointmentId);
    return reviews.map(mapReview);
  }
}

export const marketplaceService = new MarketplaceService();
