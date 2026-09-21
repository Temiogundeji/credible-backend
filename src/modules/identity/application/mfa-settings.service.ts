import type { AuthenticationEventWriter, MfaFactorRepository, MfaService } from '../domain/identity-ports';
import type { MfaFactor } from '../domain/identity-types';
import { IdentityApplicationError } from './identity-errors';

export interface MfaSettingsDependencies {
  readonly factors: MfaFactorRepository;
  readonly mfa: MfaService;
  readonly events: AuthenticationEventWriter;
  readonly now: () => Date;
}

export class MfaSettingsService {
  constructor(private readonly dependencies: MfaSettingsDependencies) {}

  async beginTotpEnrollment(input: { userId: string }): Promise<{ challengeId: string; enrollmentData: string }> {
    const active = await this.dependencies.factors.listActive(input.userId);
    if (active.some((factor) => factor.type === 'totp')) {
      throw new IdentityApplicationError('identity_already_exists', 'TOTP MFA is already enabled for this account');
    }
    return this.dependencies.mfa.beginEnrollment({ userId: input.userId, factorType: 'totp' });
  }

  async confirmTotpEnrollment(input: { userId: string; agencyId: string; challengeId: string; code: string }): Promise<MfaFactor> {
    const verified = await this.dependencies.mfa.verify({ userId: input.userId, challengeId: input.challengeId, code: input.code });
    if (!verified) throw new IdentityApplicationError('invalid_mfa', 'The MFA code is invalid or expired');
    const factor = (await this.dependencies.factors.listActive(input.userId)).find((item) => item.type === 'totp');
    if (!factor) throw new IdentityApplicationError('invalid_mfa', 'MFA enrollment could not be completed');
    await this.dependencies.events.write({ userId: input.userId, agencyId: input.agencyId, type: 'mfa_challenge_succeeded', occurredAt: this.dependencies.now(), metadata: { action: 'enrollment_confirmed', factor: 'totp' } });
    return factor;
  }

  listFactors(userId: string): Promise<readonly MfaFactor[]> { return this.dependencies.factors.listActive(userId); }
}
