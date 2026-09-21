import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaContributorEventWriter, PrismaContributorRepository } from '../../infrastructure/prisma/contributor-repositories';
import { IDENTITY_PORTS } from '../identity/domain/identity-ports';
import { CONTRIBUTOR_PORTS } from './domain/contributor-ports';
import type { ContributorEmailService, ContributorTokenGenerator } from './domain/contributor-ports';
import { ContributorManagementService } from './application/contributor-management.service';
import { ContributorController, ContributorInvitationController } from './presentation/contributor.controller';
import { ApprovedBusinessDatePolicy } from '../../shared/domain/time/business-date-policy';
import { ObligationGenerationService } from './application/obligation-generation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContributorController, ContributorInvitationController],
  providers: [
    PrismaContributorRepository,
    PrismaContributorEventWriter,
    ApprovedBusinessDatePolicy,
    {
      provide: ObligationGenerationService,
      inject: [CONTRIBUTOR_PORTS.Repository, CONTRIBUTOR_PORTS.EventWriter, ApprovedBusinessDatePolicy],
      useFactory: (repository, events, policy: ApprovedBusinessDatePolicy): ObligationGenerationService => new ObligationGenerationService(repository, events, policy, () => new Date()),
    },
    { provide: CONTRIBUTOR_PORTS.Repository, useExisting: PrismaContributorRepository },
    { provide: CONTRIBUTOR_PORTS.EventWriter, useExisting: PrismaContributorEventWriter },
    { provide: CONTRIBUTOR_PORTS.Email, inject: [IDENTITY_PORTS.EmailService], useFactory: (email: ContributorEmailService): ContributorEmailService => email },
    { provide: CONTRIBUTOR_PORTS.TokenGenerator, inject: [IDENTITY_PORTS.OneTimeTokenGenerator], useFactory: (generator: ContributorTokenGenerator): ContributorTokenGenerator => generator },
    {
      provide: ContributorManagementService,
      inject: [CONTRIBUTOR_PORTS.Repository, CONTRIBUTOR_PORTS.EventWriter, CONTRIBUTOR_PORTS.TokenGenerator, CONTRIBUTOR_PORTS.Email, ConfigService, ApprovedBusinessDatePolicy],
      useFactory: (repository, events, tokenGenerator, email, config: ConfigService, businessDatePolicy: ApprovedBusinessDatePolicy): ContributorManagementService => new ContributorManagementService({ repository, events, tokenGenerator, email, now: () => new Date(), frontendUrl: config.getOrThrow<string>('app.frontendUrl'), businessDatePolicy }),
    },
  ],
})
export class ContributorsModule {}
