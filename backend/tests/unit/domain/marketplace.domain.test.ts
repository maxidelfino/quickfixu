import {
  APPOINTMENT_CANCELLATION_ACTORS,
  APPOINTMENT_STATUSES,
  PROPOSAL_STATUSES,
  REQUEST_MEDIA_TYPES,
  REQUEST_STATUSES,
  calculateNextRatingSummary,
  resolveAppointmentCancellationState,
  resolveAppointmentCompletionState,
  resolveAppointmentSchedulingState,
  resolveAppointmentStartState,
  resolveReviewEligibility,
} from '../../../src/domain/marketplace';

describe('marketplace domain foundation', () => {
  it('defines the canonical V1 request, proposal, appointment, and media statuses', () => {
    expect(REQUEST_STATUSES).toEqual([
      'draft',
      'published',
      'receiving_proposals',
      'in_coordination',
      'closed',
      'completed',
      'expired',
    ]);

    expect(PROPOSAL_STATUSES).toEqual([
      'sent',
      'viewed',
      'accepted',
      'rejected',
      'expired',
      'withdrawn',
    ]);

    expect(APPOINTMENT_STATUSES).toEqual([
      'coordinating',
      'scheduled',
      'in_progress',
      'pending_completion_confirmation',
      'completed',
      'cancelled',
    ]);

    expect(REQUEST_MEDIA_TYPES).toEqual(['image', 'video']);
    expect(APPOINTMENT_CANCELLATION_ACTORS).toEqual(['client', 'professional', 'system']);
  });

  it('keeps appointments pending completion confirmation until both participants confirm', () => {
    const clientConfirmedAt = new Date('2026-04-18T14:00:00.000Z');

    expect(
      resolveAppointmentCompletionState({
        clientConfirmedCompletionAt: clientConfirmedAt,
        professionalConfirmedCompletionAt: null,
      })
    ).toEqual({
      status: 'pending_completion_confirmation',
      completedAt: null,
    });
  });

  it('marks appointments completed when the second participant confirms', () => {
    const clientConfirmedAt = new Date('2026-04-18T14:00:00.000Z');
    const professionalConfirmedAt = new Date('2026-04-18T15:30:00.000Z');

    expect(
      resolveAppointmentCompletionState({
        clientConfirmedCompletionAt: clientConfirmedAt,
        professionalConfirmedCompletionAt: professionalConfirmedAt,
      })
    ).toEqual({
      status: 'completed',
      completedAt: professionalConfirmedAt,
    });
  });

  it('moves coordinating appointments to scheduled on the first agreed date and time', () => {
    expect(
      resolveAppointmentSchedulingState({
        currentStatus: 'coordinating',
        rescheduledCount: 0,
        mode: 'initial',
      })
    ).toEqual({
      status: 'scheduled',
      rescheduledCount: 0,
    });
  });

  it('increments rescheduled count when a scheduled appointment is updated', () => {
    expect(
      resolveAppointmentSchedulingState({
        currentStatus: 'scheduled',
        rescheduledCount: 1,
        mode: 'update',
      })
    ).toEqual({
      status: 'scheduled',
      rescheduledCount: 2,
    });
  });

  it('allows appointments to start only after they are scheduled', () => {
    expect(resolveAppointmentStartState('scheduled')).toEqual({
      status: 'in_progress',
    });
  });

  it('closes the linked request when an appointment is cancelled', () => {
    expect(resolveAppointmentCancellationState('scheduled')).toEqual({
      appointmentStatus: 'cancelled',
      requestStatus: 'closed',
    });
  });

  it('allows reviews only after an appointment reaches confirmed completion', () => {
    expect(
      resolveReviewEligibility({
        appointmentStatus: 'completed',
        completedAt: new Date('2026-04-18T16:00:00.000Z'),
      })
    ).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it('keeps reviews blocked before confirmed completion', () => {
    expect(
      resolveReviewEligibility({
        appointmentStatus: 'pending_completion_confirmation',
        completedAt: null,
      })
    ).toEqual({
      eligible: false,
      reason: 'Appointment must be completed before reviews can be created',
    });
  });

  it('starts a reviewed user rating summary from the first review', () => {
    expect(
      calculateNextRatingSummary({
        currentRating: 0,
        currentRatingCount: 0,
        newRating: 5,
      })
    ).toEqual({
      rating: 5,
      ratingCount: 1,
    });
  });

  it('recalculates a reviewed user rating summary with two-decimal precision', () => {
    expect(
      calculateNextRatingSummary({
        currentRating: 4.5,
        currentRatingCount: 2,
        newRating: 5,
      })
    ).toEqual({
      rating: 4.67,
      ratingCount: 3,
    });
  });
});
