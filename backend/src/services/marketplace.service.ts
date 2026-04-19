import { resolveAppointmentCompletionState } from '../domain/marketplace';
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
    rescheduledCount: appointment.rescheduledCount,
    clientConfirmedCompletionAt: appointment.clientConfirmedCompletionAt,
    professionalConfirmedCompletionAt: appointment.professionalConfirmedCompletionAt,
    completedAt: appointment.completedAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    request: appointment.request,
    proposal: appointment.proposal,
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

  async confirmAppointmentCompletion(actor: AuthenticatedActor, appointmentId: number) {
    const appointment = await marketplaceRepository.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    if (appointment.status === 'cancelled') {
      throw new AppError(409, 'Cancelled appointments cannot be completed');
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
}

export const marketplaceService = new MarketplaceService();
