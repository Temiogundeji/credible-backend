import { AgentManagementService } from '../src/modules/agents/application/agent-management.service';
import type { AgentEventWriter, AgentRepository } from '../src/modules/agents/domain/agent-ports';
import type { Agent, AgentAssignment } from '../src/modules/agents/domain/agent-types';

describe('AgentManagementService', () => {
  const now = new Date('2026-09-21T10:00:00.000Z');
  const agent: Agent = {
    id: 'agent-1', agencyId: 'agency-1', userId: null, identifier: 'AG-1', displayName: 'Amina Yusuf',
    email: null, phone: null, territory: null, status: 'active', version: 1, deactivatedAt: null, createdAt: now, updatedAt: now,
  };

  function setup(): { service: AgentManagementService; repository: jest.Mocked<AgentRepository>; events: jest.Mocked<AgentEventWriter> } {
    const repository: jest.Mocked<AgentRepository> = {
      list: jest.fn(), findById: jest.fn().mockResolvedValue(agent), create: jest.fn().mockResolvedValue(agent),
      update: jest.fn().mockResolvedValue({ ...agent, version: 2 }), deactivate: jest.fn().mockResolvedValue({ ...agent, status: 'inactive', version: 2 }),
      listAssignments: jest.fn().mockResolvedValue([]), assignTerritory: jest.fn().mockResolvedValue({
        id: 'assignment-1', agencyId: 'agency-1', agentId: 'agent-1', territory: 'Ikeja', effectiveFrom: now, effectiveTo: null, createdAt: now, updatedAt: now,
      } satisfies AgentAssignment),
    };
    const events: jest.Mocked<AgentEventWriter> = { write: jest.fn().mockResolvedValue(undefined) };
    return { service: new AgentManagementService({ agents: repository, events, now: () => now }), repository, events };
  }

  it('rejects a stale profile update without writing an event', async () => {
    const { service, repository, events } = setup();
    repository.update.mockResolvedValue(null);
    await expect(service.update({ agencyId: 'agency-1', actorUserId: 'user-1', agentId: 'agent-1', expectedVersion: 1, displayName: 'New name' }))
      .rejects.toMatchObject({ code: 'agent_conflict' });
    expect(events.write).not.toHaveBeenCalled();
  });

  it('does not assign territory to an inactive agent', async () => {
    const { service, repository } = setup();
    repository.findById.mockResolvedValue({ ...agent, status: 'inactive' });
    await expect(service.assignTerritory({ agencyId: 'agency-1', actorUserId: 'user-1', agentId: 'agent-1', territory: 'Ikeja', effectiveFrom: now }))
      .rejects.toMatchObject({ code: 'agent_inactive' });
    expect(repository.assignTerritory).not.toHaveBeenCalled();
  });
});
