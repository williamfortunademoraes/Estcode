import type { UserRole } from '@/src/types/domain';

export function canManageCatalog(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageUsers(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canRegisterStock(role: UserRole | null): boolean {
  return role === 'admin' || role === 'operator';
}

export function canRegisterAdjustment(role: UserRole | null, operatorAdjustmentsAllowed: boolean): boolean {
  return role === 'admin' || (role === 'operator' && operatorAdjustmentsAllowed);
}

export function canConsult(role: UserRole | null): boolean {
  return role === 'admin' || role === 'operator' || role === 'consultant';
}
