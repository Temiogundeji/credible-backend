import type { AuthPolicyService, PasswordBlocklist } from '../domain/auth-policy';
import type {
  AgencyRepository,
  AuthenticationEventWriter,
  CredentialRepository,
  EmailService,
  IdentityTransaction,
  OneTimeTokenGenerator,
  OneTimeTokenRepository,
  PasswordHasher,
  PasswordHistoryRepository,
  SessionRepository,
  UserRepository,
} from '../domain/identity-ports';
import { IdentityApplicationError } from './identity-errors';

export interface AccountLifecycleDependencies {
  readonly agencies: AgencyRepository;
  readonly users: UserRepository;
  readonly credentials: CredentialRepository;
  readonly passwordHistory: PasswordHistoryRepository;
  readonly sessions: SessionRepository;
  readonly oneTimeTokens: OneTimeTokenRepository;
  readonly tokenGenerator: OneTimeTokenGenerator;
  readonly passwordHasher: PasswordHasher;
  readonly passwordBlocklist: PasswordBlocklist;
  readonly email: EmailService;
  readonly events: AuthenticationEventWriter;
  readonly transaction: IdentityTransaction;
  readonly now: () => Date;
  readonly frontendUrl: string;
}

export class AccountLifecycleService {
  constructor(
    private readonly dependencies: AccountLifecycleDependencies,
    private readonly authPolicy: AuthPolicyService,
  ) {}

  async verifyEmail(token: string, correlationId?: string): Promise<void> {
    const now = this.dependencies.now();
    await this.dependencies.transaction.run(async () => {
      const verification = await this.dependencies.oneTimeTokens.consumeValid({
        purpose: 'email_verification',
        tokenHash: this.dependencies.tokenGenerator.hash(token),
        consumedAt: now,
      });
      if (!verification) throw new IdentityApplicationError('invalid_one_time_token', 'Invalid or expired verification token');
      const user = await this.dependencies.users.findById(verification.userId);
      if (!user) throw new IdentityApplicationError('invalid_one_time_token', 'Invalid or expired verification token');
      await this.dependencies.users.markEmailVerified(user.id, now);
      await this.dependencies.agencies.activate(user.agencyId);
      await this.dependencies.events.write({ userId: user.id, agencyId: user.agencyId, type: 'email_verified', occurredAt: now, correlationId });
    });
  }

  async requestPasswordReset(emailValue: string, correlationId?: string): Promise<void> {
    const email = emailValue.trim().toLowerCase();
    const user = await this.dependencies.users.findByEmail(email);
    if (!user) return;
    const now = this.dependencies.now();
    const token = this.dependencies.tokenGenerator.generate();
    await this.dependencies.oneTimeTokens.issue({
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: this.dependencies.tokenGenerator.hash(token),
      expiresAt: new Date(now.getTime() + this.authPolicy.getPolicy().passwordResetTokenTtlSeconds * 1000),
    });
    await this.dependencies.email.sendPasswordResetEmail({
      recipient: user.email,
      token,
      resetUrl: `${this.dependencies.frontendUrl}/reset-password`,
    });
    await this.dependencies.events.write({ userId: user.id, agencyId: user.agencyId, type: 'password_reset_requested', occurredAt: now, correlationId });
  }

  async resetPassword(token: string, newPassword: string, correlationId?: string): Promise<void> {
    const now = this.dependencies.now();
    await this.dependencies.transaction.run(async () => {
      const reset = await this.dependencies.oneTimeTokens.consumeValid({
        purpose: 'password_reset',
        tokenHash: this.dependencies.tokenGenerator.hash(token),
        consumedAt: now,
      });
      if (!reset) throw new IdentityApplicationError('invalid_one_time_token', 'Invalid or expired reset token');
      const policy = await this.authPolicy.validatePassword(newPassword, this.dependencies.passwordBlocklist);
      if (!policy.valid) throw new IdentityApplicationError('password_rejected', 'Password does not meet policy');
      const history = await this.dependencies.passwordHistory.findRecentHashes(reset.userId, this.authPolicy.getPolicy().password.historySize);
      const currentCredential = await this.dependencies.credentials.findByUserId(reset.userId);
      const priorHashes = currentCredential ? [currentCredential.passwordHash, ...history] : history;
      for (const previousHash of priorHashes) {
        if (await this.dependencies.passwordHasher.verify(previousHash, newPassword)) {
          throw new IdentityApplicationError('password_rejected', 'Password was recently used');
        }
      }
      await this.dependencies.credentials.replacePassword({
        userId: reset.userId,
        passwordHash: await this.dependencies.passwordHasher.hash(newPassword),
        passwordChangedAt: now,
        retainedHistoryHashes: [
          ...priorHashes,
        ].slice(0, this.authPolicy.getPolicy().password.historySize),
      });
      const user = await this.dependencies.users.findById(reset.userId);
      if (!user) throw new IdentityApplicationError('invalid_one_time_token', 'Invalid or expired reset token');
      await this.dependencies.sessions.revokeAllForUser(user.id, now, 'password_reset');
      await this.dependencies.events.write({ userId: user.id, agencyId: user.agencyId, type: 'password_changed', occurredAt: now, correlationId });
    });
  }
}
