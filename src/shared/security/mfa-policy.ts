export interface MfaPolicy {
  readonly enabled: boolean;
}

/**
 * MFA capability is enabled by configuration. Enrollment, challenge, recovery,
 * and role/action enforcement must be implemented from the approved auth contract.
 */
export function assertMfaCapability(policy: MfaPolicy): void {
  if (!policy.enabled) throw new Error('MFA capability is disabled');
}
