import type { IdentityRole, UserId } from '../domain/identity-types';

export interface RegisterAgencyAdminCommand {
  readonly agencyId: string;
  readonly email: string;
  readonly password: string;
  readonly correlationId?: string;
}

export interface AuthenticateCommand {
  readonly email: string;
  readonly password: string;
  readonly mfaChallengeId?: string;
  readonly mfaCode?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly correlationId?: string;
}

export interface RefreshSessionCommand {
  readonly refreshToken: string;
  readonly correlationId?: string;
}

export interface RevokeSessionCommand {
  readonly sessionId: string;
  readonly actorUserId: UserId;
  readonly correlationId?: string;
}

export interface RequestPasswordResetCommand {
  readonly email: string;
  readonly correlationId?: string;
}

export interface CompletePasswordResetCommand {
  readonly token: string;
  readonly newPassword: string;
  readonly correlationId?: string;
}

export interface AuthenticationResult {
  readonly userId: UserId;
  readonly agencyId: string;
  readonly roles: readonly IdentityRole[];
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
  readonly mfaRequired: boolean;
  readonly sessionId: string;
}

export interface MfaRequiredResult {
  readonly mfaRequired: true;
  readonly userId: UserId;
  readonly challengeId: string;
  readonly allowedFactors: readonly ('passkey' | 'totp')[];
}

export type AuthenticateResult = AuthenticationResult | MfaRequiredResult;
