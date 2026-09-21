import type { AuthPolicyService } from '../domain/auth-policy';
import type {
  AuthenticationEventWriter,
  AuthenticationRateLimiter,
  CredentialRepository,
  IdentityTransaction,
  MfaFactorRepository,
  MfaService,
  PasswordHasher,
  SessionRepository,
  TokenService,
  UserRepository,
} from '../domain/identity-ports';
import type { SessionPolicyService } from '../domain/session-policy';
import type {
  AuthenticateCommand,
  AuthenticateResult,
  RefreshSessionCommand,
  RevokeSessionCommand,
} from './authentication-contracts';
import { IdentityApplicationError } from './identity-errors';

export interface IdentityClock {
  now(): Date;
}

export interface IdentityIdGenerator {
  generate(): string;
}

export interface AuthenticationDependencies {
  readonly users: UserRepository;
  readonly credentials: CredentialRepository;
  readonly passwordHasher: PasswordHasher;
  readonly sessions: SessionRepository;
  readonly tokens: TokenService;
  readonly mfaFactors: MfaFactorRepository;
  readonly mfa: MfaService;
  readonly events: AuthenticationEventWriter;
  readonly rateLimiter: AuthenticationRateLimiter;
  readonly transaction: IdentityTransaction;
  readonly clock: IdentityClock;
  readonly ids: IdentityIdGenerator;
}

export class AuthenticationService {
  constructor(
    private readonly dependencies: AuthenticationDependencies,
    private readonly authPolicy: AuthPolicyService,
    private readonly sessionPolicy: SessionPolicyService,
  ) {}

  async authenticate(command: AuthenticateCommand): Promise<AuthenticateResult> {
    const email = normalizeEmail(command.email);
    const rate = await this.dependencies.rateLimiter.check({ identifier: email, ipAddress: command.ipAddress });
    if (!rate.allowed) {
      throw new IdentityApplicationError('rate_limited', 'Too many authentication attempts');
    }
    const user = await this.dependencies.users.findByEmail(email);
    const credentials = user ? await this.dependencies.credentials.findByUserId(user.id) : null;

    if (!user || !credentials || !(await this.dependencies.passwordHasher.verify(credentials.passwordHash, command.password))) {
      await this.dependencies.rateLimiter.recordFailure({ identifier: email, ipAddress: command.ipAddress });
      await this.recordFailedLogin(user?.id, user?.agencyId, command.correlationId);
      throw new IdentityApplicationError('invalid_credentials', 'Invalid email or password');
    }

    if (user.disabledAt) {
      throw new IdentityApplicationError('account_disabled', 'This account is disabled');
    }

    if (!user.emailVerifiedAt) {
      throw new IdentityApplicationError('email_not_verified', 'Email verification is required');
    }

    const activeFactors = await this.dependencies.mfaFactors.listActive(user.id);
    const requiresMfa = this.authPolicy.requiresEnrolledMfa(activeFactors.length > 0);

    if (requiresMfa && (!command.mfaChallengeId || !command.mfaCode)) {
      const challenge = await this.dependencies.mfa.beginChallenge({
        userId: user.id,
        factorType: activeFactors[0].type,
      });
      return {
        mfaRequired: true,
        userId: user.id,
        challengeId: challenge.challengeId,
        allowedFactors: activeFactors.map((factor) => factor.type),
      };
    }

    if (requiresMfa) {
      const verified = await this.dependencies.mfa.verify({
        userId: user.id,
        challengeId: command.mfaChallengeId as string,
        code: command.mfaCode as string,
      });
      if (!verified) {
        await this.dependencies.events.write({
          userId: user.id,
          agencyId: user.agencyId,
          type: 'mfa_challenge_failed',
          occurredAt: this.dependencies.clock.now(),
          correlationId: command.correlationId,
        });
        throw new IdentityApplicationError('invalid_mfa', 'MFA verification failed');
      }
    }

    const activeSessionCount = await this.dependencies.sessions.countActiveForUser(user.id);
    if (!this.sessionPolicy.canCreateSession(activeSessionCount)) {
      throw new IdentityApplicationError('session_limit_reached', 'Maximum active sessions reached');
    }

    const now = this.dependencies.clock.now();
    const sessionId = this.dependencies.ids.generate();
    const refreshFamilyId = this.dependencies.ids.generate();
    const refreshTokenExpiresAt = addSeconds(now, this.authPolicy.getPolicy().refreshTokenTtlSeconds);
    const accessTokenExpiresAt = addSeconds(now, this.authPolicy.getPolicy().accessTokenTtlSeconds);
    const refreshToken = await this.dependencies.tokens.issueRefreshToken({
      sessionId,
      refreshFamilyId,
      issuedAt: now,
      expiresAt: refreshTokenExpiresAt,
    });
    const refreshTokenHash = await this.dependencies.tokens.hashRefreshToken(refreshToken);

    await this.dependencies.transaction.run(async () => {
      await this.dependencies.sessions.create({
        sessionId,
        userId: user.id,
        agencyId: user.agencyId,
        roles: user.roles,
        createdAt: now,
        lastActivityAt: now,
        expiresAt: addSeconds(now, this.sessionPolicy.absoluteTimeoutFor(user.roles)),
        refreshFamilyId,
        refreshTokenHash,
        mfaSatisfiedAt: requiresMfa ? now : null,
      });
    });

    const accessToken = await this.dependencies.tokens.issueAccessToken({
      userId: user.id,
      agencyId: user.agencyId,
      roles: user.roles,
      sessionId,
      issuedAt: now,
      expiresAt: accessTokenExpiresAt,
    });

    await this.dependencies.events.write({
      userId: user.id,
      agencyId: user.agencyId,
      type: 'login_succeeded',
      occurredAt: now,
      correlationId: command.correlationId,
    });

    return {
      userId: user.id,
      agencyId: user.agencyId,
      roles: user.roles,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      mfaRequired: requiresMfa,
      sessionId,
    };
  }

  async refresh(command: RefreshSessionCommand): Promise<AuthenticateResult> {
    const presentedHash = await this.dependencies.tokens.hashRefreshToken(command.refreshToken);
    const tokenRecord = await this.dependencies.sessions.findByRefreshTokenHash(presentedHash);
    if (!tokenRecord) {
      throw new IdentityApplicationError('invalid_refresh_token', 'Invalid refresh token');
    }

    const { session } = tokenRecord;
    if (session.revokedAt) {
      throw new IdentityApplicationError('invalid_refresh_token', 'Invalid refresh token');
    }

    if (!tokenRecord.isCurrent) {
      const now = this.dependencies.clock.now();
      await this.dependencies.sessions.revokeAllForUser(session.userId, now, 'refresh_token_reuse');
      await this.dependencies.events.write({
        userId: session.userId,
        agencyId: session.agencyId,
        type: 'refresh_reused',
        occurredAt: now,
        correlationId: command.correlationId,
      });
      throw new IdentityApplicationError('refresh_token_reuse_detected', 'Refresh token reuse detected');
    }

    const now = this.dependencies.clock.now();
    const nextRefreshToken = await this.dependencies.tokens.issueRefreshToken({
      sessionId: session.id,
      refreshFamilyId: session.refreshFamilyId,
      issuedAt: now,
      expiresAt: addSeconds(now, this.authPolicy.getPolicy().refreshTokenTtlSeconds),
    });
    const nextRefreshTokenHash = await this.dependencies.tokens.hashRefreshToken(nextRefreshToken);

    const rotated = await this.dependencies.transaction.run(() =>
        this.dependencies.sessions.rotateRefreshToken({
          sessionId: session.id,
          expectedRefreshTokenHash: presentedHash,
          nextRefreshTokenHash,
          lastActivityAt: now,
        }),
      );
    if (!rotated) {
      await this.dependencies.sessions.revokeAllForUser(session.userId, now, 'refresh_token_reuse');
      await this.dependencies.events.write({
        userId: session.userId,
        agencyId: session.agencyId,
        type: 'refresh_reused',
        occurredAt: now,
        correlationId: command.correlationId,
      });
      throw new IdentityApplicationError('refresh_token_reuse_detected', 'Refresh token reuse detected');
    }

    const accessTokenExpiresAt = addSeconds(now, this.authPolicy.getPolicy().accessTokenTtlSeconds);
    const accessToken = await this.dependencies.tokens.issueAccessToken({
      userId: session.userId,
      agencyId: session.agencyId,
      roles: session.roles,
      sessionId: session.id,
      issuedAt: now,
      expiresAt: accessTokenExpiresAt,
    });

    return {
      userId: session.userId,
      agencyId: session.agencyId,
      roles: session.roles,
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt: addSeconds(now, this.authPolicy.getPolicy().refreshTokenTtlSeconds),
      mfaRequired: session.mfaSatisfiedAt !== null,
      sessionId: session.id,
    };
  }

  async revoke(command: RevokeSessionCommand): Promise<void> {
    const session = await this.dependencies.sessions.findById(command.sessionId);
    if (!session || session.userId !== command.actorUserId) {
      throw new IdentityApplicationError('session_not_found', 'Session not found');
    }
    const now = this.dependencies.clock.now();
    await this.dependencies.sessions.revoke(session.id, now, 'user_logout');
    await this.dependencies.events.write({
      userId: session.userId,
      agencyId: session.agencyId,
      type: 'session_revoked',
      occurredAt: now,
      correlationId: command.correlationId,
    });
  }

  private async recordFailedLogin(
    userId: string | undefined,
    agencyId: string | undefined,
    correlationId?: string,
  ): Promise<void> {
    await this.dependencies.events.write({
      userId,
      agencyId,
      type: 'login_failed',
      occurredAt: this.dependencies.clock.now(),
      correlationId,
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
