export interface SessionPolicy {
  readonly maxActiveSessions: number;
  readonly idleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly absoluteTimeoutSeconds: number;
  readonly privilegedAbsoluteTimeoutSeconds: number;
}

export class SessionPolicyService {
  constructor(private readonly policy: SessionPolicy) {}

  idleTimeoutFor(roles: readonly string[]): number {
    return roles.some((role) => role === 'admin' || role === 'finance_reviewer')
      ? this.policy.privilegedIdleTimeoutSeconds
      : this.policy.idleTimeoutSeconds;
  }

  absoluteTimeoutFor(roles: readonly string[]): number {
    return roles.some((role) => role === 'admin' || role === 'finance_reviewer')
      ? this.policy.privilegedAbsoluteTimeoutSeconds
      : this.policy.absoluteTimeoutSeconds;
  }

  canCreateSession(activeSessionCount: number): boolean {
    return activeSessionCount < this.policy.maxActiveSessions;
  }
}
