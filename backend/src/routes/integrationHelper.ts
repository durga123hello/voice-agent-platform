export function mapIntegrationAgent(agent: any) {
  return {
    id: agent.id,
    tenant_id: agent.tenantId,
    tenantId: agent.tenantId,
    type: agent.type,
    name: agent.name,
    provider_vendor: agent.providerVendor,
    providerVendor: agent.providerVendor,
    status: agent.status,
    config: agent.config,
    created_at: agent.createdAt ? agent.createdAt.toISOString() : undefined,
    createdAt: agent.createdAt ? agent.createdAt.toISOString() : undefined,
    updated_at: agent.updatedAt ? agent.updatedAt.toISOString() : undefined,
    updatedAt: agent.updatedAt ? agent.updatedAt.toISOString() : undefined,
  };
}
