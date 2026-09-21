import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ContributorEventWriter, ContributorRepository } from '../../modules/contributors/domain/contributor-ports';
import type { Contributor, ContributorAssignment, ContributorObligation, ContributorPlan, ContributorStatus, PlanFrequency } from '../../modules/contributors/domain/contributor-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaContributorRepository implements ContributorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: { agencyId: string; status?: ContributorStatus; search?: string; agentId?: string }): Promise<readonly Contributor[]> {
    const search = input.search?.trim();
    const rows = await this.prisma.currentExecutor().contributor.findMany({
      where: {
        agencyId: input.agencyId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.agentId ? { assignments: { some: { agentId: input.agentId, effectiveTo: null } } } : {}),
        ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { referenceNumber: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapContributor);
  }

  async findById(input: { agencyId: string; contributorId: string }): Promise<Contributor | null> {
    const row = await this.prisma.currentExecutor().contributor.findFirst({ where: { id: input.contributorId, agencyId: input.agencyId } });
    return row ? mapContributor(row) : null;
  }

  async create(input: {
    agencyId: string; referenceNumber: string; fullName: string; email?: string; phone?: string; address?: string;
    nextOfKin?: Readonly<Record<string, unknown>>; kycReference?: string; now: Date;
  }): Promise<Contributor> {
    const row = await this.prisma.currentExecutor().contributor.create({
      data: {
        agencyId: input.agencyId,
        referenceNumber: input.referenceNumber.trim(),
        fullName: input.fullName.trim(),
        email: input.email?.trim().toLowerCase(),
        phone: input.phone?.trim(),
        address: input.address?.trim(),
        nextOfKin: input.nextOfKin as Prisma.InputJsonValue | undefined,
        kycReference: input.kycReference,
        status: input.email ? 'invited' : 'active',
        createdAt: input.now,
      },
    });
    return mapContributor(row);
  }

  async createBatch(input: { agencyId: string; rows: readonly { referenceNumber: string; fullName: string; email?: string; phone?: string; address?: string }[]; now: Date }): Promise<readonly Contributor[]> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const rows = await Promise.all(input.rows.map((row) => executor.contributor.create({ data: {
        agencyId: input.agencyId, referenceNumber: row.referenceNumber.trim(), fullName: row.fullName.trim(), email: row.email?.trim().toLowerCase(), phone: row.phone?.trim(), address: row.address?.trim(), status: row.email ? 'invited' : 'active', createdAt: input.now,
      } })));
      return rows.map(mapContributor);
    });
  }

  async update(input: {
    agencyId: string; contributorId: string; expectedVersion: number; fullName?: string; email?: string | null;
    phone?: string | null; address?: string | null; nextOfKin?: Readonly<Record<string, unknown>> | null; now: Date;
  }): Promise<Contributor | null> {
    const result = await this.prisma.currentExecutor().contributor.updateMany({
      where: { id: input.contributorId, agencyId: input.agencyId, version: input.expectedVersion, status: { not: 'deactivated' } },
      data: {
        ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
        ...(input.email === undefined ? {} : { email: input.email?.trim().toLowerCase() }),
        ...(input.phone === undefined ? {} : { phone: input.phone?.trim() }),
        ...(input.address === undefined ? {} : { address: input.address?.trim() }),
        ...(input.nextOfKin === undefined ? {} : { nextOfKin: input.nextOfKin as Prisma.InputJsonValue }),
        version: { increment: 1 },
        updatedAt: input.now,
      },
    });
    if (result.count !== 1) return null;
    return mapContributor(await this.prisma.currentExecutor().contributor.findUniqueOrThrow({ where: { id: input.contributorId } }));
  }

  async changeStatus(input: { agencyId: string; contributorId: string; expectedVersion: number; status: ContributorStatus; now: Date }): Promise<Contributor | null> {
    const result = await this.prisma.currentExecutor().contributor.updateMany({
      where: { id: input.contributorId, agencyId: input.agencyId, version: input.expectedVersion },
      data: { status: input.status, deactivatedAt: input.status === 'deactivated' ? input.now : null, version: { increment: 1 }, updatedAt: input.now },
    });
    if (result.count !== 1) return null;
    return mapContributor(await this.prisma.currentExecutor().contributor.findUniqueOrThrow({ where: { id: input.contributorId } }));
  }

  async listAssignments(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorAssignment[]> {
    const rows = await this.prisma.currentExecutor().contributorAssignment.findMany({ where: input, orderBy: { effectiveFrom: 'desc' } });
    return rows;
  }

  async assign(input: { agencyId: string; contributorId: string; agentId: string; effectiveFrom: Date; now: Date }): Promise<ContributorAssignment> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const agent = await executor.agent.findFirst({ where: { id: input.agentId, agencyId: input.agencyId, status: 'active' } });
      if (!agent) throw new Error('agent_inactive');
      await executor.contributorAssignment.updateMany({
        where: { agencyId: input.agencyId, contributorId: input.contributorId, effectiveTo: null, effectiveFrom: { lt: input.effectiveFrom } },
        data: { effectiveTo: input.effectiveFrom, updatedAt: input.now },
      });
      return executor.contributorAssignment.create({
        data: { agencyId: input.agencyId, contributorId: input.contributorId, agentId: input.agentId, effectiveFrom: input.effectiveFrom, createdAt: input.now },
      });
    });
  }

  async listPlans(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorPlan[]> {
    const rows = await this.prisma.currentExecutor().contributorPlan.findMany({ where: input, orderBy: { startDate: 'desc' } });
    return rows.map(mapPlan);
  }

  async createPlan(input: {
    agencyId: string; contributorId: string; frequency: PlanFrequency; amountMinor: bigint; currency: string; targetMinor?: bigint;
    startDate: Date; endDate?: Date; now: Date;
  }): Promise<ContributorPlan> {
    const row = await this.prisma.currentExecutor().contributorPlan.create({
      data: {
        agencyId: input.agencyId, contributorId: input.contributorId, frequency: input.frequency, amountMinor: input.amountMinor,
        currency: input.currency.toUpperCase(), targetMinor: input.targetMinor, startDate: input.startDate, endDate: input.endDate,
        status: 'active', createdAt: input.now,
      },
    });
    return mapPlan(row);
  }

  async listObligations(input: { agencyId: string; contributorId: string; from?: Date; to?: Date }): Promise<readonly ContributorObligation[]> {
    const rows = await this.prisma.currentExecutor().contributorObligation.findMany({ where: { agencyId: input.agencyId, contributorId: input.contributorId, ...(input.from || input.to ? { dueDate: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}) }, orderBy: { dueDate: 'asc' } });
    return rows.map(mapObligation);
  }

  async createObligations(input: { agencyId: string; contributorId: string; planId: string; obligations: readonly { dueDate: Date; expectedAmountMinor: bigint; currency: string; policyVersion: string }[]; now: Date }): Promise<readonly ContributorObligation[]> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor(); const result: ContributorObligation[] = [];
      for (const obligation of input.obligations) {
        const row = await executor.contributorObligation.upsert({ where: { planId_dueDate: { planId: input.planId, dueDate: obligation.dueDate } }, create: { agencyId: input.agencyId, contributorId: input.contributorId, planId: input.planId, dueDate: obligation.dueDate, expectedAmountMinor: obligation.expectedAmountMinor, outstandingMinor: obligation.expectedAmountMinor, currency: obligation.currency, status: 'scheduled', policyVersion: obligation.policyVersion, createdAt: input.now }, update: {} });
        result.push(mapObligation(row));
      }
      return result;
    });
  }

  async issueInvitation(input: { agencyId: string; contributorId: string; email: string; tokenHash: string; expiresAt: Date; now: Date }): Promise<void> {
    await this.prisma.currentExecutor().contributorInvitation.create({ data: { ...input, email: input.email.toLowerCase() } });
  }

  async consumeInvitation(input: { tokenHash: string; now: Date }): Promise<Contributor | null> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const invitation = await executor.contributorInvitation.findFirst({ where: { tokenHash: input.tokenHash, consumedAt: null, expiresAt: { gt: input.now } } });
      if (!invitation) return null;
      const consumed = await executor.contributorInvitation.updateMany({ where: { id: invitation.id, consumedAt: null }, data: { consumedAt: input.now } });
      if (consumed.count !== 1) return null;
      const contributor = await executor.contributor.update({ where: { id: invitation.contributorId }, data: { status: 'active', version: { increment: 1 }, updatedAt: input.now } });
      return mapContributor(contributor);
    });
  }
}

@Injectable()
export class PrismaContributorEventWriter implements ContributorEventWriter {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: Parameters<ContributorEventWriter['write']>[0]): Promise<void> {
    await this.prisma.currentExecutor().authenticationEvent.create({
      data: { agencyId: input.agencyId, userId: input.actorUserId, eventType: input.type, occurredAt: input.occurredAt, metadata: { contributorId: input.contributorId, ...(input.metadata ?? {}) } as Prisma.InputJsonValue },
    });
  }
}

function mapContributor(row: Prisma.ContributorGetPayload<undefined>): Contributor {
  return { id: row.id, agencyId: row.agencyId, referenceNumber: row.referenceNumber, fullName: row.fullName, email: row.email, phone: row.phone, address: row.address, nextOfKin: row.nextOfKin as Readonly<Record<string, unknown>> | null, kycReference: row.kycReference, status: row.status, version: row.version, deactivatedAt: row.deactivatedAt, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

  function mapPlan(row: Prisma.ContributorPlanGetPayload<undefined>): ContributorPlan {
  return { id: row.id, agencyId: row.agencyId, contributorId: row.contributorId, frequency: row.frequency, amountMinor: row.amountMinor, currency: row.currency, targetMinor: row.targetMinor, startDate: row.startDate, endDate: row.endDate, status: row.status, version: row.version };
  }

  function mapObligation(row: Prisma.ContributorObligationGetPayload<undefined>): ContributorObligation {
    return { id: row.id, agencyId: row.agencyId, contributorId: row.contributorId, planId: row.planId, dueDate: row.dueDate, expectedAmountMinor: row.expectedAmountMinor, paidAmountMinor: row.paidAmountMinor, outstandingMinor: row.outstandingMinor, currency: row.currency, status: row.status, policyVersion: row.policyVersion };
  }
