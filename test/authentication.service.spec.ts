import { AuthPolicyService } from '../src/modules/identity/domain/auth-policy';
import { AuthenticationService } from '../src/modules/identity/application/authentication.service';
import type { AuthenticationDependencies } from '../src/modules/identity/application/authentication.service';
import type { IdentityApplicationError } from '../src/modules/identity/application/identity-errors';
import type { IdentityUser } from '../src/modules/identity/domain/identity-types';
import { SessionPolicyService } from '../src/modules/identity/domain/session-policy';

describe('AuthenticationService', () => {
  const user: IdentityUser = {
    id: 'user-1',
    agencyId: 'agency-1',
    email: 'admin@example.com',
    roles: ['admin'],
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    disabledAt: null,
  };

  const authPolicy = new AuthPolicyService({
    mfaEnabled: true,
    mfaRequiredRoles: ['admin', 'finance_reviewer'],
    mfaFactors: ['passkey', 'totp'],
    password: { minLength: 15, maxLength: 128, historySize: 5 },
    accessTokenTtlSeconds: 600,
    refreshTokenTtlSeconds: 2592000,
    maxActiveSessions: 5,
    sessionIdleTimeoutSeconds: 1800,
    privilegedIdleTimeoutSeconds: 900,
    sessionAbsoluteTimeoutSeconds: 43200,
    privilegedAbsoluteTimeoutSeconds: 28800,
    verificationTokenTtlSeconds: 900,
    passwordResetTokenTtlSeconds: 900,
  });
  const sessionPolicy = new SessionPolicyService({
    maxActiveSessions: 5,
    idleTimeoutSeconds: 1800,
    privilegedIdleTimeoutSeconds: 900,
    absoluteTimeoutSeconds: 43200,
    privilegedAbsoluteTimeoutSeconds: 28800,
  });

  it('does not reveal whether an email exists when credentials are invalid', async () => {
    const events = { write: jest.fn().mockResolvedValue(undefined) };
    const dependencies = {
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
      credentials: { findByUserId: jest.fn() },
      passwordHasher: { verify: jest.fn(), hash: jest.fn() },
      rateLimiter: {
        check: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
        recordFailure: jest.fn().mockResolvedValue(undefined),
      },
      events,
      clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
    } as unknown as AuthenticationDependencies;
    const service = new AuthenticationService(dependencies, authPolicy, sessionPolicy);

    await expect(service.authenticate({ email: 'missing@example.com', password: 'not-a-password' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    } satisfies Partial<IdentityApplicationError>);
    expect(events.write).toHaveBeenCalledWith(expect.objectContaining({ type: 'login_failed' }));
  });

  it('requires MFA before creating a privileged session', async () => {
    const events = { write: jest.fn().mockResolvedValue(undefined) };
    const dependencies = {
      users: { findByEmail: jest.fn().mockResolvedValue(user) },
      credentials: { findByUserId: jest.fn().mockResolvedValue({ passwordHash: 'hash' }) },
      passwordHasher: { verify: jest.fn().mockResolvedValue(true) },
      rateLimiter: {
        check: jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
        recordFailure: jest.fn().mockResolvedValue(undefined),
      },
      mfaFactors: { listActive: jest.fn().mockResolvedValue([{ type: 'totp' }]) },
      mfa: { beginChallenge: jest.fn().mockResolvedValue({ challengeId: 'challenge-1' }) },
      sessions: { create: jest.fn(), countActiveForUser: jest.fn() },
      events,
    } as unknown as AuthenticationDependencies;
    const service = new AuthenticationService(dependencies, authPolicy, sessionPolicy);

    await expect(service.authenticate({ email: user.email, password: 'correct-password' })).resolves.toEqual({
      mfaRequired: true,
      userId: user.id,
      challengeId: 'challenge-1',
      allowedFactors: ['totp'],
    });
    expect(dependencies.sessions.create).not.toHaveBeenCalled();
  });
});
