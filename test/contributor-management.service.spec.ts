import { ContributorManagementService } from '../src/modules/contributors/application/contributor-management.service';
import type { ContributorEmailService, ContributorEventWriter, ContributorRepository, ContributorTokenGenerator } from '../src/modules/contributors/domain/contributor-ports';
import type { Contributor } from '../src/modules/contributors/domain/contributor-types';
import { ApprovedBusinessDatePolicy } from '../src/shared/domain/time/business-date-policy';

describe('ContributorManagementService', () => {
  const now = new Date('2026-09-21T10:00:00.000Z');
  const contributor: Contributor = {
    id: 'contributor-1', agencyId: 'agency-1', referenceNumber: 'CON-1', fullName: 'Amina Yusuf', email: 'amina@example.com', phone: null,
    address: null, nextOfKin: null, kycReference: null, status: 'invited', version: 1, deactivatedAt: null, createdAt: now, updatedAt: now,
  };

  function setup(): { service: ContributorManagementService; repository: jest.Mocked<ContributorRepository>; events: jest.Mocked<ContributorEventWriter>; email: jest.Mocked<ContributorEmailService> } {
    const repository: jest.Mocked<ContributorRepository> = {
      list: jest.fn(), findById: jest.fn().mockResolvedValue(contributor), create: jest.fn().mockResolvedValue(contributor), createBatch: jest.fn().mockResolvedValue([contributor]), update: jest.fn(), changeStatus: jest.fn(),
      listAssignments: jest.fn().mockResolvedValue([]), assign: jest.fn(), listPlans: jest.fn().mockResolvedValue([]), createPlan: jest.fn(), listObligations: jest.fn().mockResolvedValue([]), createObligations: jest.fn().mockResolvedValue([]), issueInvitation: jest.fn().mockResolvedValue(undefined), consumeInvitation: jest.fn(),
    };
    const events: jest.Mocked<ContributorEventWriter> = { write: jest.fn().mockResolvedValue(undefined) };
    const email: jest.Mocked<ContributorEmailService> = { sendContributorInvitationEmail: jest.fn().mockResolvedValue(undefined) };
    const tokenGenerator: jest.Mocked<ContributorTokenGenerator> = { generate: jest.fn().mockReturnValue('raw-token'), hash: jest.fn().mockReturnValue('token-hash') };
    return { service: new ContributorManagementService({ repository, events, email, tokenGenerator, now: () => now, frontendUrl: 'http://localhost:5173', businessDatePolicy: new ApprovedBusinessDatePolicy() }), repository, events, email };
  }

  it('creates a contributor and sends one invitation when email is provided', async () => {
    const { service, repository, email, events } = setup();
    await service.create({ agencyId: 'agency-1', actorUserId: 'user-1', referenceNumber: 'CON-1', fullName: 'Amina', email: 'amina@example.com' });
    expect(repository.issueInvitation).toHaveBeenCalledTimes(1);
    expect(email.sendContributorInvitationEmail).toHaveBeenCalledTimes(1);
    expect(events.write).toHaveBeenCalledWith(expect.objectContaining({ type: 'contributor_invited' }));
  });

  it('rejects invalid plan amounts before persistence', async () => {
    const { service, repository } = setup();
    await expect(service.createPlan({ agencyId: 'agency-1', actorUserId: 'user-1', contributorId: 'contributor-1', frequency: 'daily', amountMinor: 0n, currency: 'NGN', startDate: now })).rejects.toMatchObject({ code: 'plan_invalid' });
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('rejects duplicate batch references before persistence', async () => {
    const { service, repository } = setup();
    await expect(service.createBatch({ agencyId: 'agency-1', actorUserId: 'user-1', rows: [
      { referenceNumber: 'CON-1', fullName: 'Amina' }, { referenceNumber: 'CON-1', fullName: 'Bola' },
    ] })).rejects.toMatchObject({ code: 'plan_invalid' });
    expect(repository.createBatch).not.toHaveBeenCalled();
  });
});
