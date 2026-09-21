import { Module } from '@nestjs/common';
import { IDENTITY_PORTS } from '../../modules/identity/domain/identity-ports';
import { PrismaAgencyRepository, PrismaAuthenticationEventWriter, PrismaCredentialRepository, PrismaMfaFactorRepository, PrismaOneTimeTokenRepository, PrismaPasswordHistoryRepository, PrismaSessionRepository, PrismaUserRepository } from './identity-repositories';
import { Argon2idPasswordHasher } from './password-hasher';
import { PrismaIdentityTransaction, PrismaService } from './prisma.service';
import { JwtTokenService } from '../security/jwt-token.service';
import { RedisAuthenticationRateLimiter } from '../security/redis-rate-limiter';
import { TotpMfaService } from '../security/totp-mfa.service';
import { CryptoOneTimeTokenGenerator } from '../security/one-time-token-generator';
import { RedisPasswordBlocklist } from '../security/redis-password-blocklist';
import { ResendEmailService } from '../email/resend-email.service';
import { PrismaAgentEventWriter, PrismaAgentRepository } from './agent-repositories';
import { AGENT_PORTS } from '../../modules/agents/domain/agent-ports';
import { PrismaContributorEventWriter, PrismaContributorRepository } from './contributor-repositories';
import { CONTRIBUTOR_PORTS } from '../../modules/contributors/domain/contributor-ports';

// This module owns Prisma lifecycle and adapter composition. It does not export
// PrismaClient to application or domain code.

@Module({
  providers: [
    PrismaService,
    PrismaIdentityTransaction,
    PrismaUserRepository,
    PrismaAgencyRepository,
    PrismaCredentialRepository,
    PrismaPasswordHistoryRepository,
    PrismaOneTimeTokenRepository,
    PrismaSessionRepository,
    PrismaMfaFactorRepository,
    PrismaAuthenticationEventWriter,
    Argon2idPasswordHasher,
    JwtTokenService,
    CryptoOneTimeTokenGenerator,
    RedisAuthenticationRateLimiter,
    TotpMfaService,
    RedisPasswordBlocklist,
    ResendEmailService,
    PrismaAgentRepository,
    PrismaAgentEventWriter,
    PrismaContributorRepository,
    PrismaContributorEventWriter,
    { provide: AGENT_PORTS.AgentRepository, useExisting: PrismaAgentRepository },
    { provide: AGENT_PORTS.AgentEventWriter, useExisting: PrismaAgentEventWriter },
    { provide: CONTRIBUTOR_PORTS.Repository, useExisting: PrismaContributorRepository },
    { provide: CONTRIBUTOR_PORTS.EventWriter, useExisting: PrismaContributorEventWriter },
    { provide: IDENTITY_PORTS.UserRepository, useExisting: PrismaUserRepository },
    { provide: IDENTITY_PORTS.AgencyRepository, useExisting: PrismaAgencyRepository },
    { provide: IDENTITY_PORTS.CredentialRepository, useExisting: PrismaCredentialRepository },
    { provide: IDENTITY_PORTS.PasswordHistoryRepository, useExisting: PrismaPasswordHistoryRepository },
    { provide: IDENTITY_PORTS.OneTimeTokenRepository, useExisting: PrismaOneTimeTokenRepository },
    { provide: IDENTITY_PORTS.SessionRepository, useExisting: PrismaSessionRepository },
    { provide: IDENTITY_PORTS.MfaFactorRepository, useExisting: PrismaMfaFactorRepository },
    { provide: IDENTITY_PORTS.AuthenticationEventWriter, useExisting: PrismaAuthenticationEventWriter },
    { provide: IDENTITY_PORTS.PasswordHasher, useExisting: Argon2idPasswordHasher },
    { provide: IDENTITY_PORTS.TokenService, useExisting: JwtTokenService },
    { provide: IDENTITY_PORTS.OneTimeTokenGenerator, useExisting: CryptoOneTimeTokenGenerator },
    { provide: IDENTITY_PORTS.PasswordBlocklist, useExisting: RedisPasswordBlocklist },
    { provide: IDENTITY_PORTS.EmailService, useExisting: ResendEmailService },
    { provide: IDENTITY_PORTS.AuthenticationRateLimiter, useExisting: RedisAuthenticationRateLimiter },
    { provide: IDENTITY_PORTS.MfaService, useExisting: TotpMfaService },
    { provide: IDENTITY_PORTS.IdentityTransaction, useExisting: PrismaIdentityTransaction },
  ],
  exports: [
    PrismaService,
    PrismaIdentityTransaction,
    IDENTITY_PORTS.UserRepository,
    IDENTITY_PORTS.AgencyRepository,
    IDENTITY_PORTS.CredentialRepository,
    IDENTITY_PORTS.PasswordHistoryRepository,
    IDENTITY_PORTS.OneTimeTokenRepository,
    IDENTITY_PORTS.SessionRepository,
    IDENTITY_PORTS.MfaFactorRepository,
    IDENTITY_PORTS.AuthenticationEventWriter,
    IDENTITY_PORTS.PasswordHasher,
    IDENTITY_PORTS.TokenService,
    IDENTITY_PORTS.OneTimeTokenGenerator,
    IDENTITY_PORTS.PasswordBlocklist,
    IDENTITY_PORTS.EmailService,
    IDENTITY_PORTS.AuthenticationRateLimiter,
    IDENTITY_PORTS.MfaService,
    IDENTITY_PORTS.IdentityTransaction,
    AGENT_PORTS.AgentRepository,
    AGENT_PORTS.AgentEventWriter,
    CONTRIBUTOR_PORTS.Repository,
    CONTRIBUTOR_PORTS.EventWriter,
  ],
})
export class PrismaModule {}
