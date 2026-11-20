import { canConsult, canManageCatalog, canManageUsers, canRegisterAdjustment, canRegisterStock } from '@/src/features/auth/permissions';

describe('role permissions used by the interface', () => {
  it('allows only administrators to manage the catalog', () => {
    expect(canManageCatalog('admin')).toBe(true);
    expect(canManageCatalog('operator')).toBe(false);
    expect(canManageCatalog('consultant')).toBe(false);
  });

  it('keeps user administration restricted and consultation available to all roles', () => {
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('operator')).toBe(false);
    expect(canConsult('consultant')).toBe(true);
    expect(canConsult(null)).toBe(false);
  });

  it('allows operators to move stock but requires the inventory setting for adjustments', () => {
    expect(canRegisterStock('operator')).toBe(true);
    expect(canRegisterStock('consultant')).toBe(false);
    expect(canRegisterAdjustment('operator', false)).toBe(false);
    expect(canRegisterAdjustment('operator', true)).toBe(true);
    expect(canRegisterAdjustment('admin', false)).toBe(true);
  });
});
