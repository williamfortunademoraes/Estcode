import { loginSchema, passwordRecoverySchema, passwordUpdateSchema } from '@/src/features/auth/auth-schema';

describe('auth schemas', () => {
  it('accepts a valid login and trims the email', () => {
    expect(
      loginSchema.parse({ email: '  user@example.com ', password: 'secret123' }),
    ).toEqual({ email: 'user@example.com', password: 'secret123' });
  });

  it('rejects weak passwords and malformed emails', () => {
    expect(() => loginSchema.parse({ email: 'invalid', password: '123' })).toThrow();
  });

  it('requires a valid email for password recovery', () => {
    expect(() => passwordRecoverySchema.parse({ email: 'invalid' })).toThrow();
    expect(passwordRecoverySchema.parse({ email: 'person@example.com' })).toEqual({
      email: 'person@example.com',
    });
  });

  it('requires matching strong passwords for a reset', () => {
    expect(passwordUpdateSchema.parse({ password: 'secret123', passwordConfirmation: 'secret123' }).password).toBe('secret123');
    expect(() => passwordUpdateSchema.parse({ password: 'secret123', passwordConfirmation: 'different' })).toThrow();
  });
});
