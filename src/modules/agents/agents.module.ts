import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AGENT_PORTS } from './domain/agent-ports';
import { AgentManagementService } from './application/agent-management.service';
import { AgentController } from './presentation/agent.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AgentController],
  providers: [
    {
      provide: AgentManagementService,
      inject: [AGENT_PORTS.AgentRepository, AGENT_PORTS.AgentEventWriter],
      useFactory: (agents, events): AgentManagementService =>
        new AgentManagementService({ agents, events, now: () => new Date() }),
    },
  ],
})
export class AgentsModule {}
