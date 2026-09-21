import { Injectable } from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import {
  AuthenticationEventWriter,
  AgencyRepository,
  CredentialRepository,
  MfaFactorRepository,
  OneTimeTokenRepository,
  PasswordHistoryRepository,
  SessionRepository,
  UserRepository,
} from '../../modules/identity/domain/identity-ports';
import {
  AuthenticationSession,
  Agency,
  IdentityRole,
  IdentityUser,
  MfaFactor,
  OneTimeToken,
  PasswordCredential,
  UserId,
} from '../../modules/identity/domain/identity-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const user = await this.prisma.currentExecutor().user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    return user ? mapUser(user) : null;
  }

  async findById(id: UserId): Promise<IdentityUser | null> {
    const user = await this.prisma.currentExecutor().user.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { status: 'active' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    return user ? mapUser(user) : null;
  }

  async create(input: { agencyId: string; email: string; roles: readonly string[] }): Promise<IdentityUser> {
    const user = await this.prisma.currentExecutor().user.create({
      data: {
        email: input.email,
        memberships: {
          create: input.roles.map((role) => ({
            agencyId: input.agencyId,
            role: role as MembershipRole,
            status: 'active',
          })),
        },
      },
      include: { memberships: true },
    });
    return mapUser(user);
  }

  async markEmailVerified(userId: UserId, verifiedAt: Date): Promise<void> {
    await this.prisma.currentExecutor().user.update({
      where: { id: userId },
      data: { emailVerifiedAt: verifiedAt },
    });
  }
}

@Injectable()
export class PrismaAgencyRepository implements AgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { legalName: string; timezone: string; currency: string }): Promise<Agency> {
    const agency = await this.prisma.currentExecutor().agency.create({
      data: { legalName: input.legalName, timezone: input.timezone, currency: input.currency, status: 'pending' },
    });
    return {
      id: agency.id,
      legalName: agency.legalName,
      timezone: agency.timezone,
      currency: agency.currency,
      status: agency.status,
    };
  }

  async activate(agencyId: string): Promise<void> {
    await this.prisma.currentExecutor().agency.update({ where: { id: agencyId }, data: { status: 'active' } });
  }
}

@Injectable()
export class PrismaCredentialRepository implements CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: UserId): Promise<PasswordCredential | null> {
    const credential = await this.prisma.currentExecutor().passwordCredential.findUnique({ where: { userId } });
    return credential
      ? {
          id: credential.id,
          userId: credential.userId,
          passwordHash: credential.passwordHash,
          passwordChangedAt: credential.passwordChangedAt,
          passwordHistoryHashes: [],
        }
      : null;
  }

  async create(input: { userId: string; passwordHash: string; passwordChangedAt: Date }): Promise<PasswordCredential> {
    const credential = await this.prisma.currentExecutor().passwordCredential.create({ data: input });
    return {
      id: credential.id,
      userId: credential.userId,
      passwordHash: credential.passwordHash,
      passwordChangedAt: credential.passwordChangedAt,
      passwordHistoryHashes: [],
    };
  }

  async replacePassword(input: {
    userId: string;
    passwordHash: string;
    passwordChangedAt: Date;
    retainedHistoryHashes: readonly string[];
  }): Promise<void> {
    const executor = this.prisma.currentExecutor();
    await executor.passwordCredential.update({
      where: { userId: input.userId },
      data: { passwordHash: input.passwordHash, passwordChangedAt: input.passwordChangedAt },
    });
    await executor.passwordHistory.deleteMany({ where: { userId: input.userId } });
    if (input.retainedHistoryHashes.length > 0) {
      await executor.passwordHistory.createMany({
        data: input.retainedHistoryHashes.map((passwordHash) => ({ userId: input.userId, passwordHash })),
      });
    }
  }
}

@Injectable()
export class PrismaPasswordHistoryRepository implements PasswordHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRecentHashes(userId: UserId, limit: number): Promise<readonly string[]> {
    const history = await this.prisma.currentExecutor().passwordHistory.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return history.map((entry) => entry.passwordHash);
  }
}

@Injectable()
export class PrismaOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async issue(input: {
    userId: string;
    purpose: OneTimeToken['purpose'];
    tokenHash: string;
    expiresAt: Date;
  }): Promise<OneTimeToken> {
    const token = await this.prisma.currentExecutor().oneTimeIdentityToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return mapOneTimeToken(token);
  }

  async consumeValid(input: {
    purpose: OneTimeToken['purpose'];
    tokenHash: string;
    consumedAt: Date;
  }): Promise<OneTimeToken | null> {
    const executor = this.prisma.currentExecutor();
    const updated = await executor.oneTimeIdentityToken.updateMany({
      where: {
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        consumedAt: null,
        expiresAt: { gt: input.consumedAt },
      },
      data: { consumedAt: input.consumedAt },
    });
    if (updated.count !== 1) return null;

    const token = await executor.oneTimeIdentityToken.findUnique({ where: { tokenHash: input.tokenHash } });
    return token ? mapOneTimeToken(token) : null;
  }
}

@Injectable()
export class PrismaMfaFactorRepository implements MfaFactorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(userId: UserId): Promise<readonly MfaFactor[]> {
    const factors = await this.prisma.currentExecutor().mfaFactor.findMany({
      where: { userId, revokedAt: null },
      orderBy: { enabledAt: 'asc' },
    });
    return factors.map((factor) => ({
      id: factor.id,
      userId: factor.userId,
      type: factor.factorType,
      enabledAt: factor.enabledAt,
      revokedAt: factor.revokedAt,
    }));
  }

  async findActiveSecret(userId: UserId, factorType: MfaFactor['type']): Promise<{ id: string; protectedSecretReference: string } | null> {
    const factor = await this.prisma.currentExecutor().mfaFactor.findFirst({
      where: { userId, factorType, revokedAt: null },
      select: { id: true, protectedSecretReference: true },
    });
    return factor?.protectedSecretReference
      ? { id: factor.id, protectedSecretReference: factor.protectedSecretReference }
      : null;
  }

  async create(input: {
    userId: string;
    factorType: MfaFactor['type'];
    protectedSecretReference: string;
    enabledAt: Date;
  }): Promise<MfaFactor> {
    const factor = await this.prisma.currentExecutor().mfaFactor.create({
      data: {
        userId: input.userId,
        factorType: input.factorType,
        protectedSecretReference: input.protectedSecretReference,
        enabledAt: input.enabledAt,
      },
    });
    return {
      id: factor.id,
      userId: factor.userId,
      type: factor.factorType,
      enabledAt: factor.enabledAt,
      revokedAt: factor.revokedAt,
    };
  }
}

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countActiveForUser(userId: UserId): Promise<number> {
    return this.prisma.currentExecutor().authenticationSession.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<{
    session: AuthenticationSession;
    isCurrent: boolean;
  } | null> {
    const executor = this.prisma.currentExecutor();
    const current = await executor.authenticationSession.findFirst({ where: { currentRefreshTokenHash: refreshTokenHash } });
    if (current) return { session: mapSession(current), isCurrent: true };

    const historical = await executor.refreshTokenHistory.findUnique({
      where: { tokenHash: refreshTokenHash },
      include: { session: true },
    });
    return historical ? { session: mapSession(historical.session), isCurrent: false } : null;
  }

  async create(input: {
    sessionId: string;
    userId: string;
    agencyId: string;
    roles: readonly string[];
    createdAt: Date;
    lastActivityAt: Date;
    expiresAt: Date;
    refreshFamilyId: string;
    refreshTokenHash: string;
    mfaSatisfiedAt: Date | null;
  }): Promise<AuthenticationSession> {
    const executor = this.prisma.currentExecutor();
    const session = await executor.authenticationSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        agencyId: input.agencyId,
        roles: input.roles as Prisma.InputJsonValue,
        createdAt: input.createdAt,
        lastActivityAt: input.lastActivityAt,
        expiresAt: input.expiresAt,
        refreshFamilyId: input.refreshFamilyId,
        currentRefreshTokenHash: input.refreshTokenHash,
        mfaSatisfiedAt: input.mfaSatisfiedAt,
        refreshTokenHistory: {
          create: {
            refreshFamilyId: input.refreshFamilyId,
            tokenHash: input.refreshTokenHash,
            issuedAt: input.createdAt,
          },
        },
      },
    });
    return mapSession(session);
  }

  async findById(id: string): Promise<AuthenticationSession | null> {
    const session = await this.prisma.currentExecutor().authenticationSession.findUnique({ where: { id } });
    return session ? mapSession(session) : null;
  }

  async rotateRefreshToken(input: {
    sessionId: string;
    expectedRefreshTokenHash: string;
    nextRefreshTokenHash: string;
    lastActivityAt: Date;
  }): Promise<AuthenticationSession | null> {
    const work = async (): Promise<AuthenticationSession | null> => {
      const executor = this.prisma.currentExecutor();
      const updated = await executor.authenticationSession.updateMany({
        where: { id: input.sessionId, currentRefreshTokenHash: input.expectedRefreshTokenHash, revokedAt: null },
        data: { currentRefreshTokenHash: input.nextRefreshTokenHash, lastActivityAt: input.lastActivityAt },
      });
      if (updated.count !== 1) return null;

      await executor.refreshTokenHistory.updateMany({
        where: { sessionId: input.sessionId, tokenHash: input.expectedRefreshTokenHash, revokedAt: null },
        data: { revokedAt: input.lastActivityAt, replacedByHash: input.nextRefreshTokenHash },
      });
      await executor.refreshTokenHistory.create({
        data: {
          sessionId: input.sessionId,
          refreshFamilyId: (await executor.authenticationSession.findUniqueOrThrow({ where: { id: input.sessionId } })).refreshFamilyId,
          tokenHash: input.nextRefreshTokenHash,
          issuedAt: input.lastActivityAt,
        },
      });
      const session = await executor.authenticationSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      return mapSession(session);
    };

    return this.prisma.currentExecutor() === this.prisma ? this.prisma.runInTransaction(work) : work();
  }

  async revoke(sessionId: string, revokedAt: Date, reason: string): Promise<void> {
    await this.prisma.currentExecutor().authenticationSession.update({
      where: { id: sessionId },
      data: { revokedAt, revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, revokedAt: Date, reason: string): Promise<void> {
    await this.prisma.currentExecutor().authenticationSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt, revokedReason: reason },
    });
  }
}

@Injectable()
export class PrismaAuthenticationEventWriter implements AuthenticationEventWriter {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: Parameters<AuthenticationEventWriter['write']>[0]): Promise<void> {
    await this.prisma.currentExecutor().authenticationEvent.create({
      data: {
        userId: input.userId,
        agencyId: input.agencyId,
        eventType: input.type,
        occurredAt: input.occurredAt,
        correlationId: input.correlationId,
        metadata: input.metadata ?? {},
      },
    });
  }
}

function mapUser(user: Prisma.UserGetPayload<{ include: { memberships: true } }>): IdentityUser {
  const membership = user.memberships[0];
  if (!membership) throw new Error('Identity user has no active agency membership');
  return {
    id: user.id,
    agencyId: membership.agencyId,
    email: user.email,
    roles: [membership.role as IdentityRole],
    emailVerifiedAt: user.emailVerifiedAt,
    disabledAt: user.disabledAt,
  };
}

function mapSession(session: Prisma.AuthenticationSessionGetPayload<undefined>): AuthenticationSession {
  return {
    id: session.id,
    userId: session.userId,
    agencyId: session.agencyId,
    roles: session.roles as IdentityRole[],
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    refreshFamilyId: session.refreshFamilyId,
    refreshTokenHash: session.currentRefreshTokenHash,
    mfaSatisfiedAt: session.mfaSatisfiedAt,
  };
}

function mapOneTimeToken(token: Prisma.OneTimeIdentityTokenGetPayload<undefined>): OneTimeToken {
  return {
    id: token.id,
    userId: token.userId,
    purpose: token.purpose,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    consumedAt: token.consumedAt,
  };
}
