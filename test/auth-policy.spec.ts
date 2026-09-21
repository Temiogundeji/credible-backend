import { AuthPolicyService } from '../src/modules/identity/domain/auth-policy';

const policy = new AuthPolicyService({
  mfaEnabled: true,
  mfaRequiredRoles: ['admin', 'finance_reviewer'],
  mfaFactors: ['passkey', 'totp'],
  password: { minLength: 15, maxLength: 128, historySize: 5 },
  accessTokenTtlSeconds: 600,
  refreshTokenTtlSeconds: 2_592_000,
  maxActiveSessions: 5,
  sessionIdleTimeoutSeconds: 1800,
  privilegedIdleTimeoutSeconds: 900,
  sessionAbsoluteTimeoutSeconds: 43_200,
  privilegedAbsoluteTimeoutSeconds: 28_800,
  verificationTokenTtlSeconds: 900,
  passwordResetTokenTtlSeconds: 900,
});

const blocklist = { contains: async (value: string): Promise<boolean> => value === 'passwordpasswordpassword' };

describe('AuthPolicyService', () => {
  it('requires MFA for approved privileged roles', () => {
    expect(policy.requiresMfa(['admin'])).toBe(true);
    expect(policy.requiresMfa(['agent'])).toBe(false);
  });

  it('validates length and compromised-password policy', async () => {
    await expect(policy.validatePassword('short', blocklist)).resolves.toEqual({
      valid: false,
      errors: ['password_too_short'],
    });
    await expect(policy.validatePassword('passwordpasswordpassword', blocklist)).resolves.toEqual({
      valid: false,
      errors: ['password_compromised'],
    });
  });
});
