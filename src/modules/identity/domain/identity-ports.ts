import type {
  AgencyId,
  Agency,
  AuthenticationSession,
  IdentityUser,
  MfaFactor,
  OneTimeToken,
  PasswordCredential,
  SessionId,
  UserId,
} from './identity-types';

export interface UserRepository {
  findByEmail(email: string): Promise<IdentityUser | null>;
  findById(id: UserId): Promise<IdentityUser | null>;
  create(input: {
    agencyId: AgencyId;
    email: string;
    roles: readonly string[];
  }): Promise<IdentityUser>;
  markEmailVerified(userId: UserId, verifiedAt: Date): Promise<void>;
}

export interface AgencyRepository {
  create(input: { legalName: string; timezone: string; currency: string }): Promise<Agency>;
  activate(agencyId: AgencyId): Promise<void>;
}

export interface CredentialRepository {
  findByUserId(userId: UserId): Promise<PasswordCredential | null>;
  create(input: {
    userId: UserId;
    passwordHash: string;
    passwordChangedAt: Date;
  }): Promise<PasswordCredential>;
  replacePassword(input: {
    userId: UserId;
    passwordHash: string;
    passwordChangedAt: Date;
    retainedHistoryHashes: readonly string[];
  }): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface OneTimeTokenGenerator {
  generate(): string;
  hash(token: string): string;
}

export interface EmailService {
  sendVerificationEmail(input: { recipient: string; token: string; verificationUrl: string }): Promise<void>;
  sendPasswordResetEmail(input: { recipient: string; token: string; resetUrl: string }): Promise<void>;
  sendContributorInvitationEmail(input: { recipient: string; token: string; invitationUrl: string }): Promise<void>;
}

export interface PasswordHistoryRepository {
  findRecentHashes(userId: UserId, limit: number): Promise<readonly string[]>;
}

export interface OneTimeTokenRepository {
  issue(input: {
    userId: UserId;
    purpose: OneTimeToken['purpose'];
    tokenHash: string;
    expiresAt: Date;
  }): Promise<OneTimeToken>;
  consumeValid(input: {
    purpose: OneTimeToken['purpose'];
    tokenHash: string;
    consumedAt: Date;
  }): Promise<OneTimeToken | null>;
}

export interface TokenService {
  issueAccessToken(input: {
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    sessionId: SessionId;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<string>;
  verifyAccessToken(token: string): Promise<{
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    sessionId: SessionId;
  }>;
  issueRefreshToken(input: {
    sessionId: SessionId;
    refreshFamilyId: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<string>;
  hashRefreshToken(token: string): Promise<string>;
}

export interface SessionRepository {
  countActiveForUser(userId: UserId): Promise<number>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<{
    session: AuthenticationSession;
    isCurrent: boolean;
  } | null>;
  create(input: {
    sessionId: SessionId;
    userId: UserId;
    agencyId: AgencyId;
    roles: readonly string[];
    createdAt: Date;
    lastActivityAt: Date;
    expiresAt: Date;
    refreshFamilyId: string;
    refreshTokenHash: string;
    mfaSatisfiedAt: Date | null;
  }): Promise<AuthenticationSession>;
  findById(id: SessionId): Promise<AuthenticationSession | null>;
  rotateRefreshToken(input: {
    sessionId: SessionId;
    expectedRefreshTokenHash: string;
    nextRefreshTokenHash: string;
    lastActivityAt: Date;
  }): Promise<AuthenticationSession | null>;
  revoke(sessionId: SessionId, revokedAt: Date, reason: string): Promise<void>;
  revokeAllForUser(userId: UserId, revokedAt: Date, reason: string): Promise<void>;
}

export interface MfaFactorRepository {
  listActive(userId: UserId): Promise<readonly MfaFactor[]>;
  findActiveSecret(userId: UserId, factorType: MfaFactor['type']): Promise<{
    id: string;
    protectedSecretReference: string;
  } | null>;
  create(input: {
    userId: UserId;
    factorType: MfaFactor['type'];
    protectedSecretReference: string;
    enabledAt: Date;
  }): Promise<MfaFactor>;
}

export interface MfaService {
  beginChallenge(input: { userId: UserId; factorType: MfaFactor['type'] }): Promise<{
    challengeId: string;
  }>;
  beginEnrollment(input: { userId: UserId; factorType: MfaFactor['type'] }): Promise<{
    challengeId: string;
    enrollmentData: string;
  }>;
  verify(input: { userId: UserId; challengeId: string; code: string }): Promise<boolean>;
}

export interface AuthenticationRateLimiter {
  check(input: { identifier: string; ipAddress?: string }): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
  recordFailure(input: { identifier: string; ipAddress?: string }): Promise<void>;
}

export interface AuthenticationEventWriter {
  write(input: {
    userId?: UserId;
    agencyId?: AgencyId;
    type:
      | 'login_succeeded'
      | 'agency_registered'
      | 'email_verified'
      | 'password_reset_requested'
      | 'password_changed'
      | 'login_failed'
      | 'refresh_reused'
      | 'session_revoked'
      | 'mfa_challenge_succeeded'
      | 'mfa_challenge_failed';
    occurredAt: Date;
    correlationId?: string;
    metadata?: Readonly<Record<string, string>>;
  }): Promise<void>;
}

export interface IdentityTransaction {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export const IDENTITY_PORTS = {
  UserRepository: Symbol('identity.user-repository'),
  AgencyRepository: Symbol('identity.agency-repository'),
  CredentialRepository: Symbol('identity.credential-repository'),
  PasswordHasher: Symbol('identity.password-hasher'),
  OneTimeTokenGenerator: Symbol('identity.one-time-token-generator'),
  PasswordBlocklist: Symbol('identity.password-blocklist'),
  EmailService: Symbol('identity.email-service'),
  PasswordHistoryRepository: Symbol('identity.password-history-repository'),
  OneTimeTokenRepository: Symbol('identity.one-time-token-repository'),
  TokenService: Symbol('identity.token-service'),
  SessionRepository: Symbol('identity.session-repository'),
  MfaFactorRepository: Symbol('identity.mfa-factor-repository'),
  MfaService: Symbol('identity.mfa-service'),
  AuthenticationRateLimiter: Symbol('identity.authentication-rate-limiter'),
  AuthenticationEventWriter: Symbol('identity.authentication-event-writer'),
  IdentityTransaction: Symbol('identity.transaction'),
} as const;
