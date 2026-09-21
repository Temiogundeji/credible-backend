import { SessionPolicyService } from '../src/modules/identity/domain/session-policy';

describe('SessionPolicyService', () => {
  const service = new SessionPolicyService({
    maxActiveSessions: 5,
    idleTimeoutSeconds: 1800,
    privilegedIdleTimeoutSeconds: 900,
    absoluteTimeoutSeconds: 43200,
    privilegedAbsoluteTimeoutSeconds: 28800,
  });

  it('uses the shorter privileged timeouts for admin and finance roles', () => {
    expect(service.idleTimeoutFor(['admin'])).toBe(900);
    expect(service.absoluteTimeoutFor(['finance_reviewer'])).toBe(28800);
  });

  it('uses the standard timeouts for non-privileged roles', () => {
    expect(service.idleTimeoutFor(['agent'])).toBe(1800);
    expect(service.absoluteTimeoutFor(['agent'])).toBe(43200);
  });

  it('rejects a new session once the configured active-session limit is reached', () => {
    expect(service.canCreateSession(4)).toBe(true);
    expect(service.canCreateSession(5)).toBe(false);
  });
});
