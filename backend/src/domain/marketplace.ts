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

interface ResolveAppointmentCompletionStateInput {
  clientConfirmedCompletionAt: Date | null;
  professionalConfirmedCompletionAt: Date | null;
}

interface AppointmentCompletionState {
  status: Extract<AppointmentStatus, 'pending_completion_confirmation' | 'completed'>;
  completedAt: Date | null;
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
