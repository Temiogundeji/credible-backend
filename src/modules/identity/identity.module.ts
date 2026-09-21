import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthPolicyService } from './domain/auth-policy';
import { SessionPolicyService } from './domain/session-policy';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IDENTITY_PORTS } from './domain/identity-ports';
import { AuthenticationService } from './application/authentication.service';
import { AgencyRegistrationService } from './application/agency-registration.service';
import { AccountLifecycleService } from './application/account-lifecycle.service';
import { AuthController } from './presentation/auth.controller';
import { AccessTokenGuard } from './presentation/access-token.guard';
import { CryptoIdentityIdGenerator, SystemIdentityClock } from '../../infrastructure/security/identity-runtime';
import { MfaSettingsService } from './application/mfa-settings.service';
import { MfaSettingsController } from './presentation/mfa-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MfaSettingsController],
  providers: [
    SystemIdentityClock,
    CryptoIdentityIdGenerator,
    {
      provide: MfaSettingsService,
      inject: [IDENTITY_PORTS.MfaFactorRepository, IDENTITY_PORTS.MfaService, IDENTITY_PORTS.AuthenticationEventWriter, SystemIdentityClock],
      useFactory: (factors, mfa, events, clock): MfaSettingsService => new MfaSettingsService({ factors, mfa, events, now: () => clock.now() }),
    },
    AccessTokenGuard,
    {
      provide: AccountLifecycleService,
      inject: [
        IDENTITY_PORTS.AgencyRepository,
        IDENTITY_PORTS.UserRepository,
        IDENTITY_PORTS.CredentialRepository,
        IDENTITY_PORTS.PasswordHistoryRepository,
        IDENTITY_PORTS.SessionRepository,
        IDENTITY_PORTS.OneTimeTokenRepository,
        IDENTITY_PORTS.OneTimeTokenGenerator,
        IDENTITY_PORTS.PasswordHasher,
        IDENTITY_PORTS.PasswordBlocklist,
        IDENTITY_PORTS.EmailService,
        IDENTITY_PORTS.AuthenticationEventWriter,
        IDENTITY_PORTS.IdentityTransaction,
        AuthPolicyService,
        SystemIdentityClock,
        ConfigService,
      ],
      useFactory: (
        agencies,
        users,
        credentials,
        passwordHistory,
        sessions,
        oneTimeTokens,
        tokenGenerator,
        passwordHasher,
        passwordBlocklist,
        email,
        events,
        transaction,
        authPolicy,
        clock,
        config: ConfigService,
      ): AccountLifecycleService =>
        new AccountLifecycleService(
          {
            agencies,
            users,
            credentials,
            passwordHistory,
            sessions,
            oneTimeTokens,
            tokenGenerator,
            passwordHasher,
            passwordBlocklist,
            email,
            events,
            transaction,
            now: () => clock.now(),
            frontendUrl: config.getOrThrow<string>('app.frontendUrl'),
          },
          authPolicy,
        ),
    },
    {
      provide: AgencyRegistrationService,
      inject: [
        IDENTITY_PORTS.AgencyRepository,
        IDENTITY_PORTS.UserRepository,
        IDENTITY_PORTS.CredentialRepository,
        IDENTITY_PORTS.OneTimeTokenRepository,
        IDENTITY_PORTS.OneTimeTokenGenerator,
        IDENTITY_PORTS.PasswordHasher,
        IDENTITY_PORTS.PasswordBlocklist,
        IDENTITY_PORTS.AuthenticationEventWriter,
        IDENTITY_PORTS.EmailService,
        IDENTITY_PORTS.IdentityTransaction,
        AuthPolicyService,
        SystemIdentityClock,
        ConfigService,
      ],
      useFactory: (
        agencies,
        users,
        credentials,
        oneTimeTokens,
        tokenGenerator,
        passwordHasher,
        passwordBlocklist,
        events,
        email,
        transaction,
        authPolicy,
        clock,
        config: ConfigService,
      ): AgencyRegistrationService =>
        new AgencyRegistrationService(
          {
            agencies,
            users,
            credentials,
            oneTimeTokens,
            tokenGenerator,
            passwordHasher,
            passwordBlocklist,
            email,
            events,
            transaction,
            now: () => clock.now(),
            frontendUrl: config.getOrThrow<string>('app.frontendUrl'),
          },
          authPolicy,
        ),
    },
    {
      provide: AuthenticationService,
      inject: [
        IDENTITY_PORTS.UserRepository,
        IDENTITY_PORTS.CredentialRepository,
        IDENTITY_PORTS.PasswordHasher,
        IDENTITY_PORTS.SessionRepository,
        IDENTITY_PORTS.TokenService,
        IDENTITY_PORTS.MfaFactorRepository,
        IDENTITY_PORTS.MfaService,
        IDENTITY_PORTS.AuthenticationEventWriter,
        IDENTITY_PORTS.AuthenticationRateLimiter,
        IDENTITY_PORTS.IdentityTransaction,
        AuthPolicyService,
        SessionPolicyService,
        SystemIdentityClock,
        CryptoIdentityIdGenerator,
      ],
      useFactory: (
        users,
        credentials,
        passwordHasher,
        sessions,
        tokens,
        mfaFactors,
        mfa,
        events,
        rateLimiter,
        transaction,
        authPolicy,
        sessionPolicy,
        clock,
        ids,
      ): AuthenticationService =>
        new AuthenticationService(
          {
            users,
            credentials,
            passwordHasher,
            sessions,
            tokens,
            mfaFactors,
            mfa,
            events,
            rateLimiter,
            transaction,
            clock,
            ids,
          },
          authPolicy,
          sessionPolicy,
        ),
    },
    {
      provide: AuthPolicyService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AuthPolicyService =>
        new AuthPolicyService({
          mfaEnabled: config.getOrThrow<boolean>('app.mfaEnabled'),
          mfaRequiredRoles: config.getOrThrow<readonly string[]>('app.mfaRequiredRoles'),
          mfaFactors: config.getOrThrow<readonly string[]>('app.mfaFactors'),
          password: {
            minLength: config.getOrThrow<number>('app.passwordMinLength'),
            maxLength: config.getOrThrow<number>('app.passwordMaxLength'),
            historySize: config.getOrThrow<number>('app.passwordHistorySize'),
          },
          accessTokenTtlSeconds: config.getOrThrow<number>('app.accessTokenTtlSeconds'),
          refreshTokenTtlSeconds: config.getOrThrow<number>('app.refreshTokenTtlSeconds'),
          maxActiveSessions: config.getOrThrow<number>('app.maxActiveSessions'),
          sessionIdleTimeoutSeconds: config.getOrThrow<number>('app.sessionIdleTimeoutSeconds'),
          privilegedIdleTimeoutSeconds: config.getOrThrow<number>('app.privilegedIdleTimeoutSeconds'),
          sessionAbsoluteTimeoutSeconds: config.getOrThrow<number>('app.sessionAbsoluteTimeoutSeconds'),
          privilegedAbsoluteTimeoutSeconds: config.getOrThrow<number>('app.privilegedAbsoluteTimeoutSeconds'),
          verificationTokenTtlSeconds: config.getOrThrow<number>('app.verificationTokenTtlSeconds'),
          passwordResetTokenTtlSeconds: config.getOrThrow<number>('app.passwordResetTokenTtlSeconds'),
        }),
    },
    {
      provide: SessionPolicyService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SessionPolicyService =>
        new SessionPolicyService({
          maxActiveSessions: config.getOrThrow<number>('app.maxActiveSessions'),
          idleTimeoutSeconds: config.getOrThrow<number>('app.sessionIdleTimeoutSeconds'),
          privilegedIdleTimeoutSeconds: config.getOrThrow<number>('app.privilegedIdleTimeoutSeconds'),
          absoluteTimeoutSeconds: config.getOrThrow<number>('app.sessionAbsoluteTimeoutSeconds'),
          privilegedAbsoluteTimeoutSeconds: config.getOrThrow<number>('app.privilegedAbsoluteTimeoutSeconds'),
        }),
    },
  ],
  exports: [AuthPolicyService, SessionPolicyService, AuthenticationService, AgencyRegistrationService, AccountLifecycleService],
})
export class IdentityModule {}
