import {
  APPOINTMENT_CANCELLATION_ACTORS,
  APPOINTMENT_STATUSES,
  PROPOSAL_STATUSES,
  REQUEST_MEDIA_TYPES,
  REQUEST_STATUSES,
  resolveAppointmentCompletionState,
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
});
