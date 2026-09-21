export type UserId = string;
export type AgencyId = string;
export type SessionId = string;
export type CredentialId = string;
export type AuthenticationEventId = string;

export interface Agency {
  readonly id: AgencyId;
  readonly legalName: string;
  readonly timezone: string;
  readonly currency: string;
  readonly status: 'pending' | 'active' | 'suspended' | 'closed';
}

export type IdentityRole = 'admin' | 'finance_reviewer' | 'agent' | 'support' | 'auditor';

export interface IdentityUser {
  readonly id: UserId;
  readonly agencyId: AgencyId;
  readonly email: string;
  readonly roles: readonly IdentityRole[];
  readonly emailVerifiedAt: Date | null;
  readonly disabledAt: Date | null;
}

export interface PasswordCredential {
  readonly id: CredentialId;
  readonly userId: UserId;
  readonly passwordHash: string;
  readonly passwordChangedAt: Date;
  readonly passwordHistoryHashes: readonly string[];
}

export interface AuthenticationSession {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly agencyId: AgencyId;
  readonly roles: readonly IdentityRole[];
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly refreshFamilyId: string;
  readonly refreshTokenHash: string;
  readonly mfaSatisfiedAt: Date | null;
}

export interface MfaFactor {
  readonly id: string;
  readonly userId: UserId;
  readonly type: 'passkey' | 'totp';
  readonly enabledAt: Date;
  readonly revokedAt: Date | null;
}

export interface OneTimeToken {
  readonly id: string;
  readonly userId: UserId;
  readonly purpose: 'email_verification' | 'password_reset';
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
