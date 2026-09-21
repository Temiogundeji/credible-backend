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
  UserRepository,
} from '../domain/identity-ports';
import type { AgencyId, UserId } from '../domain/identity-types';
import { IdentityApplicationError } from './identity-errors';

export interface AgencyRegistrationDependencies {
  readonly agencies: AgencyRepository;
  readonly users: UserRepository;
  readonly credentials: CredentialRepository;
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

export interface RegisterAgencyCommand {
  readonly legalName: string;
  readonly timezone: string;
  readonly currency: string;
  readonly email: string;
  readonly password: string;
  readonly correlationId?: string;
}

export interface RegisterAgencyResult {
  readonly agencyId: AgencyId;
  readonly userId: UserId;
  readonly verificationRequired: true;
}

export class AgencyRegistrationService {
  constructor(
    private readonly dependencies: AgencyRegistrationDependencies,
    private readonly authPolicy: AuthPolicyService,
  ) {}

  async register(command: RegisterAgencyCommand): Promise<RegisterAgencyResult> {
    const email = command.email.trim().toLowerCase();
    const existing = await this.dependencies.users.findByEmail(email);
    if (existing) {
      throw new IdentityApplicationError('identity_already_exists', 'An account with this email already exists.');
    }

    const password = await this.authPolicy.validatePassword(command.password, this.dependencies.passwordBlocklist);
    if (!password.valid) throw new IdentityApplicationError('password_rejected', 'Password does not meet policy');

    const now = this.dependencies.now();
    const rawVerificationToken = this.dependencies.tokenGenerator.generate();
    let result: { agencyId: AgencyId; userId: UserId };
    try {
      result = await this.dependencies.transaction.run(async () => {
        const agency = await this.dependencies.agencies.create({
          legalName: command.legalName.trim(),
          timezone: command.timezone,
          currency: command.currency.toUpperCase(),
        });
        const user = await this.dependencies.users.create({ agencyId: agency.id, email, roles: ['admin'] });
        const passwordHash = await this.dependencies.passwordHasher.hash(command.password);
        await this.dependencies.credentials.create({ userId: user.id, passwordHash, passwordChangedAt: now });
        await this.dependencies.oneTimeTokens.issue({
          userId: user.id,
          purpose: 'email_verification',
          tokenHash: this.dependencies.tokenGenerator.hash(rawVerificationToken),
          expiresAt: new Date(now.getTime() + this.authPolicy.getPolicy().verificationTokenTtlSeconds * 1000),
        });
        return { agencyId: agency.id, userId: user.id };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new IdentityApplicationError('identity_already_exists', 'An account with this email already exists.');
      }
      throw error;
    }

    await this.dependencies.events.write({
      userId: result.userId,
      agencyId: result.agencyId,
      type: 'agency_registered',
      occurredAt: now,
      correlationId: command.correlationId,
    });
    await this.dependencies.email.sendVerificationEmail({
      recipient: email,
      token: rawVerificationToken,
      verificationUrl: `${this.dependencies.frontendUrl}/verify`,
    });
    return { ...result, verificationRequired: true };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
