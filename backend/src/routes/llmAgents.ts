import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';
import { createLlmAgentSchema, updateLlmAgentSchema } from '../validators/integrationAgent';
import { mapIntegrationAgent } from './integrationHelper';

const router = Router();
router.use(sessionAuth);

// 1. GET /api/llm-agents — List all LLM agents for tenant
router.get('/', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const agents = await prisma.integrationAgent.findMany({
      where: { tenantId, type: 'llm' },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = agents.map(mapIntegrationAgent);
    return res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching LLM agents:', error);
    return res.status(500).json({ error: 'Failed to fetch LLM agents' });
  }
});

// 2. POST /api/llm-agents — Create new LLM agent
router.post('/', requirePermission('integrations:create'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const validation = createLlmAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.flatten(),
      });
    }

    const { name, provider_vendor, status, config } = validation.data;

    // Check unique (tenantId, type, name)
    const existing = await prisma.integrationAgent.findFirst({
      where: { tenantId, type: 'llm', name },
    });

    if (existing) {
      return res.status(409).json({
        error: `An LLM agent with name '${name}' already exists for this tenant.`,
      });
    }

    const created = await prisma.integrationAgent.create({
      data: {
        tenantId,
        type: 'llm',
        name,
        providerVendor: provider_vendor,
        status: status || 'active',
        config: config as any,
      },
    });

    return res.status(201).json(mapIntegrationAgent(created));
  } catch (error: any) {
    console.error('Error creating LLM agent:', error);
    return res.status(500).json({ error: 'Failed to create LLM agent' });
  }
});

// 3. GET /api/llm-agents/:id — Get LLM agent by ID
router.get('/:id', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'llm' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'LLM Agent not found' });
    }

    return res.json(mapIntegrationAgent(agent));
  } catch (error: any) {
    console.error('Error fetching LLM agent details:', error);
    return res.status(500).json({ error: 'Failed to fetch LLM agent details' });
  }
});

// 4. PUT /api/llm-agents/:id — Update LLM agent
router.put('/:id', requirePermission('integrations:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const validation = updateLlmAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.flatten(),
      });
    }

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'llm' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'LLM Agent not found' });
    }

    const { name, provider_vendor, status, config } = validation.data;

    // Check name collision if name is being changed
    if (name && name !== agent.name) {
      const existingName = await prisma.integrationAgent.findFirst({
        where: { tenantId, type: 'llm', name, NOT: { id } },
      });
      if (existingName) {
        return res.status(409).json({
          error: `An LLM agent with name '${name}' already exists for this tenant.`,
        });
      }
    }

    const currentConfig = (agent.config as any) || {};
    const updatedConfig = config ? { ...currentConfig, ...config } : currentConfig;

    const updated = await prisma.integrationAgent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(provider_vendor && { providerVendor: provider_vendor }),
        ...(status && { status }),
        config: updatedConfig,
      },
    });

    return res.json(mapIntegrationAgent(updated));
  } catch (error: any) {
    console.error('Error updating LLM agent:', error);
    return res.status(500).json({ error: 'Failed to update LLM agent' });
  }
});

// 5. DELETE /api/llm-agents/:id — Delete LLM agent
router.delete('/:id', requirePermission('integrations:delete'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'llm' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'LLM Agent not found' });
    }

    await prisma.integrationAgent.delete({
      where: { id },
    });

    return res.json({ message: 'LLM agent deleted successfully', id });
  } catch (error: any) {
    console.error('Error deleting LLM agent:', error);
    return res.status(500).json({ error: 'Failed to delete LLM agent' });
  }
});

export default router;
