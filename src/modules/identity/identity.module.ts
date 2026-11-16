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
import { AdminMfaService } from './application/mfa-settings.service';
import { MfaSettingsController } from './presentation/mfa-settings.controller';
import { AgencyController } from './presentation/agency.controller';

/**
 * Identity module – wires up all authentication & authorization related services.
 * The admin MFA implementation (AdminMfaService) is provided as the MfaService token.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MfaSettingsController, AgencyController],
  providers: [
    SystemIdentityClock,
    CryptoIdentityIdGenerator,
    // Provide AdminMfaService under the MfaService token
    {
      provide: IDENTITY_PORTS.MfaService,
      useClass: AdminMfaService,
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
        }),
    },
  ],
  exports: [],
})
export class IdentityModule {}
