export const REQUIRED_MFA_ROLES = ['admin', 'finance_reviewer'] as const;

export interface PasswordBlocklist {
  contains(candidate: string): Promise<boolean>;
}

export interface PasswordPolicy {
  readonly minLength: number;
  readonly maxLength: number;
  readonly historySize: number;
}

export interface AuthPolicy {
  readonly mfaEnabled: boolean;
  readonly mfaRequiredRoles: readonly string[];
  readonly mfaFactors: readonly string[];
  readonly password: PasswordPolicy;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly maxActiveSessions: number;
  readonly sessionIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly sessionAbsoluteTimeoutSeconds: number;
  readonly privilegedAbsoluteTimeoutSeconds: number;
  readonly verificationTokenTtlSeconds: number;
  readonly passwordResetTokenTtlSeconds: number;
}

export interface PasswordValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export class AuthPolicyService {
  constructor(private readonly policy: AuthPolicy) {
    assertAuthPolicy(policy);
  }

  requiresMfa(roles: readonly string[]): boolean {
    return this.policy.mfaEnabled && roles.some((role) => this.policy.mfaRequiredRoles.includes(role));
  }

  requiresEnrolledMfa(hasEnrolledFactor: boolean): boolean {
    return this.policy.mfaEnabled && hasEnrolledFactor;
  }

  getPolicy(): AuthPolicy {
    return this.policy;
  }

  async validatePassword(candidate: string, blocklist: PasswordBlocklist): Promise<PasswordValidationResult> {
    const errors: string[] = [];
    const length = Array.from(candidate).length;
    if (length < this.policy.password.minLength) errors.push('password_too_short');
    if (length > this.policy.password.maxLength) errors.push('password_too_long');
    if (candidate.trim().length === 0) errors.push('password_empty');
    if (await blocklist.contains(candidate)) errors.push('password_compromised');
    return { valid: errors.length === 0, errors };
  }
}

export function assertAuthPolicy(policy: AuthPolicy): void {
  if (policy.password.minLength < 15) throw new Error('Password minimum must be at least 15');
  if (policy.password.maxLength < 64) throw new Error('Password maximum must be at least 64');
  if (policy.password.maxLength < policy.password.minLength) {
    throw new Error('Password maximum must not be less than its minimum');
  }
  if (policy.mfaEnabled && policy.mfaFactors.length === 0) {
    throw new Error('MFA factors must be configured when MFA is enabled');
  }
  if (policy.mfaEnabled && policy.mfaFactors.some((factor) => !['passkey', 'totp'].includes(factor))) {
    throw new Error('Only passkey and totp are approved MFA factors');
  }
}
