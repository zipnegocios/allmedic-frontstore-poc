import { describe, it, expect } from 'vitest';
import { getCorporateAccountActionFlags } from '../corporate-account-actions';

describe('getCorporateAccountActionFlags', () => {
  it('cuenta PENDING: puede aprobar y rechazar, no suspender', () => {
    expect(getCorporateAccountActionFlags('PENDING')).toEqual({
      canApprove: true,
      canReject: true,
      canSuspend: false,
    });
  });

  it('cuenta APPROVED: puede suspender, no aprobar ni rechazar', () => {
    expect(getCorporateAccountActionFlags('APPROVED')).toEqual({
      canApprove: false,
      canReject: false,
      canSuspend: true,
    });
  });

  it('cuenta REJECTED: puede volver a aprobar, no rechazar ni suspender', () => {
    expect(getCorporateAccountActionFlags('REJECTED')).toEqual({
      canApprove: true,
      canReject: false,
      canSuspend: false,
    });
  });

  it('cuenta SUSPENDED: puede volver a aprobar, no rechazar ni suspender de nuevo', () => {
    expect(getCorporateAccountActionFlags('SUSPENDED')).toEqual({
      canApprove: true,
      canReject: false,
      canSuspend: false,
    });
  });
});
