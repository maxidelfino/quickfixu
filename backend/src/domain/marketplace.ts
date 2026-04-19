export const REQUEST_STATUSES = [
  'draft',
  'published',
  'receiving_proposals',
  'in_coordination',
  'closed',
  'completed',
  'expired',
] as const;

export const PROPOSAL_STATUSES = [
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
] as const;

export const APPOINTMENT_STATUSES = [
  'coordinating',
  'scheduled',
  'in_progress',
  'pending_completion_confirmation',
  'completed',
  'cancelled',
] as const;

export const REQUEST_MEDIA_TYPES = ['image', 'video'] as const;

export const APPOINTMENT_CANCELLATION_ACTORS = [
  'client',
  'professional',
  'system',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type RequestMediaType = (typeof REQUEST_MEDIA_TYPES)[number];
export type AppointmentCancellationActor = (typeof APPOINTMENT_CANCELLATION_ACTORS)[number];

interface ResolveAppointmentSchedulingStateInput {
  currentStatus: AppointmentStatus;
  rescheduledCount: number;
  mode: 'initial' | 'update';
}

interface AppointmentSchedulingState {
  status: Extract<AppointmentStatus, 'scheduled'>;
  rescheduledCount: number;
}

interface ResolveAppointmentCompletionStateInput {
  clientConfirmedCompletionAt: Date | null;
  professionalConfirmedCompletionAt: Date | null;
}

interface AppointmentCompletionState {
  status: Extract<AppointmentStatus, 'pending_completion_confirmation' | 'completed'>;
  completedAt: Date | null;
}

interface AppointmentStartState {
  status: Extract<AppointmentStatus, 'in_progress'>;
}

interface AppointmentCancellationState {
  appointmentStatus: Extract<AppointmentStatus, 'cancelled'>;
  requestStatus: Extract<RequestStatus, 'closed'>;
}

interface ResolveReviewEligibilityInput {
  appointmentStatus: AppointmentStatus;
  completedAt: Date | null;
}

interface ReviewEligibilityState {
  eligible: boolean;
  reason: string | null;
}

interface CalculateNextRatingSummaryInput {
  currentRating: number;
  currentRatingCount: number;
  newRating: number;
}

interface RatingSummary {
  rating: number;
  ratingCount: number;
}

export function resolveAppointmentSchedulingState({
  currentStatus,
  rescheduledCount,
  mode,
}: ResolveAppointmentSchedulingStateInput): AppointmentSchedulingState {
  if (mode === 'initial') {
    if (currentStatus !== 'coordinating') {
      throw new Error('Appointment can only be scheduled from coordinating status');
    }

    return {
      status: 'scheduled',
      rescheduledCount,
    };
  }

  if (currentStatus !== 'scheduled') {
    throw new Error('Only scheduled appointments can be updated');
  }

  return {
    status: 'scheduled',
    rescheduledCount: rescheduledCount + 1,
  };
}

export function resolveAppointmentStartState(currentStatus: AppointmentStatus): AppointmentStartState {
  if (currentStatus !== 'scheduled') {
    throw new Error('Appointment must be scheduled before it can start');
  }

  return {
    status: 'in_progress',
  };
}

export function resolveAppointmentCancellationState(currentStatus: AppointmentStatus): AppointmentCancellationState {
  if (currentStatus === 'completed') {
    throw new Error('Completed appointments cannot be cancelled');
  }

  if (currentStatus === 'cancelled') {
    throw new Error('Appointment is already cancelled');
  }

  return {
    appointmentStatus: 'cancelled',
    requestStatus: 'closed',
  };
}

export function resolveAppointmentCompletionState({
  clientConfirmedCompletionAt,
  professionalConfirmedCompletionAt,
}: ResolveAppointmentCompletionStateInput): AppointmentCompletionState {
  if (!clientConfirmedCompletionAt || !professionalConfirmedCompletionAt) {
    return {
      status: 'pending_completion_confirmation',
      completedAt: null,
    };
  }

  return {
    status: 'completed',
    completedAt:
      clientConfirmedCompletionAt > professionalConfirmedCompletionAt
        ? clientConfirmedCompletionAt
        : professionalConfirmedCompletionAt,
  };
}

export function resolveReviewEligibility({
  appointmentStatus,
  completedAt,
}: ResolveReviewEligibilityInput): ReviewEligibilityState {
  if (appointmentStatus !== 'completed' || !completedAt) {
    return {
      eligible: false,
      reason: 'Appointment must be completed before reviews can be created',
    };
  }

  return {
    eligible: true,
    reason: null,
  };
}

export function calculateNextRatingSummary({
  currentRating,
  currentRatingCount,
  newRating,
}: CalculateNextRatingSummaryInput): RatingSummary {
  const ratingCount = currentRatingCount + 1;
  const totalRating = currentRating * currentRatingCount + newRating;

  return {
    rating: Math.round((totalRating / ratingCount) * 100) / 100,
    ratingCount,
  };
}
