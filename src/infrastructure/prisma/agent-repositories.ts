import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgentEventWriter, AgentRepository } from '../../modules/agents/domain/agent-ports';
import type { Agent, AgentAssignment, AgentStatus } from '../../modules/agents/domain/agent-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaAgentRepository implements AgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: { agencyId: string; status?: AgentStatus; search?: string }): Promise<readonly Agent[]> {
    const search = input.search?.trim();
    const rows = await this.prisma.currentExecutor().agent.findMany({
      where: {
        agencyId: input.agencyId,
        ...(input.status ? { status: input.status } : {}),
        ...(search ? { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { identifier: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapAgent);
  }

  async findById(input: { agencyId: string; agentId: string }): Promise<Agent | null> {
    const row = await this.prisma.currentExecutor().agent.findFirst({ where: { id: input.agentId, agencyId: input.agencyId } });
    return row ? mapAgent(row) : null;
  }

  async create(input: {
    agencyId: string;
    userId?: string;
    identifier: string;
    displayName: string;
    email?: string;
    phone?: string;
    territory?: string;
    now: Date;
  }): Promise<Agent> {
    const row = await this.prisma.currentExecutor().agent.create({
      data: {
        agencyId: input.agencyId,
        userId: input.userId,
        identifier: input.identifier,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        territory: input.territory,
        status: 'active',
        createdAt: input.now,
      },
    });
    return mapAgent(row);
  }

  async update(input: {
    agencyId: string;
    agentId: string;
    expectedVersion: number;
    displayName?: string;
    email?: string | null;
    phone?: string | null;
    territory?: string | null;
    now: Date;
  }): Promise<Agent | null> {
    const updated = await this.prisma.currentExecutor().agent.updateMany({
      where: { id: input.agentId, agencyId: input.agencyId, version: input.expectedVersion, status: 'active' },
      data: {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.phone === undefined ? {} : { phone: input.phone }),
        ...(input.territory === undefined ? {} : { territory: input.territory }),
        version: { increment: 1 },
        updatedAt: input.now,
      },
    });
    if (updated.count !== 1) return null;
    const row = await this.prisma.currentExecutor().agent.findUniqueOrThrow({ where: { id: input.agentId } });
    return mapAgent(row);
  }

  async deactivate(input: { agencyId: string; agentId: string; expectedVersion: number; now: Date }): Promise<Agent | null> {
    const updated = await this.prisma.currentExecutor().agent.updateMany({
      where: { id: input.agentId, agencyId: input.agencyId, version: input.expectedVersion, status: 'active' },
      data: { status: 'inactive', deactivatedAt: input.now, version: { increment: 1 }, updatedAt: input.now },
    });
    if (updated.count !== 1) return null;
    const row = await this.prisma.currentExecutor().agent.findUniqueOrThrow({ where: { id: input.agentId } });
    return mapAgent(row);
  }

  async listAssignments(input: { agencyId: string; agentId: string }): Promise<readonly AgentAssignment[]> {
    const rows = await this.prisma.currentExecutor().agentAssignment.findMany({
      where: { agencyId: input.agencyId, agentId: input.agentId },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows.map(mapAssignment);
  }

  async assignTerritory(input: {
    agencyId: string;
    agentId: string;
    territory: string;
    effectiveFrom: Date;
    now: Date;
  }): Promise<AgentAssignment> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      await executor.agentAssignment.updateMany({
        where: { agencyId: input.agencyId, agentId: input.agentId, effectiveTo: null, effectiveFrom: { lt: input.effectiveFrom } },
        data: { effectiveTo: input.effectiveFrom, updatedAt: input.now },
      });
      await executor.agent.update({
        where: { id: input.agentId },
        data: { territory: input.territory, version: { increment: 1 }, updatedAt: input.now },
      });
      const row = await executor.agentAssignment.create({
        data: {
          agencyId: input.agencyId,
          agentId: input.agentId,
          territory: input.territory,
          effectiveFrom: input.effectiveFrom,
          createdAt: input.now,
        },
      });
      return mapAssignment(row);
    });
  }
}

@Injectable()
export class PrismaAgentEventWriter implements AgentEventWriter {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: Parameters<AgentEventWriter['write']>[0]): Promise<void> {
    await this.prisma.currentExecutor().authenticationEvent.create({
      data: {
        agencyId: input.agencyId,
        userId: input.actorUserId,
        eventType: input.type,
        occurredAt: input.occurredAt,
        metadata: { agentId: input.agentId, ...(input.metadata ?? {}) } as Prisma.InputJsonValue,
      },
    });
  }
}

function mapAgent(row: Prisma.AgentGetPayload<undefined>): Agent {
  return {
    id: row.id,
    agencyId: row.agencyId,
    userId: row.userId,
    identifier: row.identifier,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    territory: row.territory,
    status: row.status,
    version: row.version,
    deactivatedAt: row.deactivatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAssignment(row: Prisma.AgentAssignmentGetPayload<undefined>): AgentAssignment {
  return {
    id: row.id,
    agencyId: row.agencyId,
    agentId: row.agentId,
    territory: row.territory,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
