export interface TenantContext {
  readonly agencyId: string;
  readonly actorId: string;
  readonly roles: readonly string[];
  readonly correlationId: string;
}

export function assertTenantId(context: TenantContext, agencyId: string): void {
  if (context.agencyId !== agencyId) throw new Error('Tenant context mismatch');
}
