import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaContributionStore } from '../../infrastructure/prisma/contribution-repositories';
import { PrismaContributionImportRepository } from '../../infrastructure/prisma/contribution-import-repository';
import { RecordContributionService } from './application/record-contribution.service';
import { ContributionImportService } from './application/contribution-import.service';
import { THRIFT_PORTS } from './domain/contribution-ports';
import { CONTRIBUTION_IMPORT_PORTS } from './domain/contribution-import-types';
import { ContributionController, ContributionImportController } from './presentation/contribution.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ContributionController, ContributionImportController],
  providers: [PrismaContributionStore, PrismaContributionImportRepository, { provide: THRIFT_PORTS.ContributionStore, useExisting: PrismaContributionStore }, { provide: CONTRIBUTION_IMPORT_PORTS.Store, useExisting: PrismaContributionImportRepository }, { provide: RecordContributionService, inject: [THRIFT_PORTS.ContributionStore], useFactory: (store: PrismaContributionStore): RecordContributionService => new RecordContributionService(store) }, { provide: ContributionImportService, inject: [CONTRIBUTION_IMPORT_PORTS.Store, RecordContributionService], useFactory: (store: PrismaContributionImportRepository, recorder: RecordContributionService): ContributionImportService => new ContributionImportService(store, (input) => recorder.record(input)) }],
})
export class ThriftModule {}
