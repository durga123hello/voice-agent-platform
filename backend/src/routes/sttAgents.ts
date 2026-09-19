import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';
import { createSttAgentSchema, updateSttAgentSchema } from '../validators/integrationAgent';
import { mapIntegrationAgent } from './integrationHelper';

const router = Router();
router.use(sessionAuth);

// 1. GET /api/stt-agents — List all STT agents for tenant
router.get('/', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const agents = await prisma.integrationAgent.findMany({
      where: { tenantId, type: 'stt' },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = agents.map(mapIntegrationAgent);
    return res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching STT agents:', error);
    return res.status(500).json({ error: 'Failed to fetch STT agents' });
  }
});

// 2. POST /api/stt-agents — Create new STT agent
router.post('/', requirePermission('integrations:create'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const validation = createSttAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.flatten(),
      });
    }

    const { name, provider_vendor, status, config } = validation.data;

    // Check unique (tenantId, type, name)
    const existing = await prisma.integrationAgent.findFirst({
      where: { tenantId, type: 'stt', name },
    });

    if (existing) {
      return res.status(409).json({
        error: `An STT agent with name '${name}' already exists for this tenant.`,
      });
    }

    const created = await prisma.integrationAgent.create({
      data: {
        tenantId,
        type: 'stt',
        name,
        providerVendor: provider_vendor,
        status: status || 'active',
        config: config as any,
      },
    });

    return res.status(201).json(mapIntegrationAgent(created));
  } catch (error: any) {
    console.error('Error creating STT agent:', error);
    return res.status(500).json({ error: 'Failed to create STT agent' });
  }
});

// 3. GET /api/stt-agents/:id — Get STT agent by ID
router.get('/:id', requirePermission('integrations:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'stt' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'STT Agent not found' });
    }

    return res.json(mapIntegrationAgent(agent));
  } catch (error: any) {
    console.error('Error fetching STT agent details:', error);
    return res.status(500).json({ error: 'Failed to fetch STT agent details' });
  }
});

// 4. PUT /api/stt-agents/:id — Update STT agent
router.put('/:id', requirePermission('integrations:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const validation = updateSttAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validation.error.flatten(),
      });
    }

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'stt' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'STT Agent not found' });
    }

    const { name, provider_vendor, status, config } = validation.data;

    // Check name collision if name is being changed
    if (name && name !== agent.name) {
      const existingName = await prisma.integrationAgent.findFirst({
        where: { tenantId, type: 'stt', name, NOT: { id } },
      });
      if (existingName) {
        return res.status(409).json({
          error: `An STT agent with name '${name}' already exists for this tenant.`,
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
    console.error('Error updating STT agent:', error);
    return res.status(500).json({ error: 'Failed to update STT agent' });
  }
});

// 5. DELETE /api/stt-agents/:id — Delete STT agent
router.delete('/:id', requirePermission('integrations:delete'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const agent = await prisma.integrationAgent.findFirst({
      where: { id, tenantId, type: 'stt' },
    });

    if (!agent) {
      return res.status(404).json({ error: 'STT Agent not found' });
    }

    await prisma.integrationAgent.delete({
      where: { id },
    });

    return res.json({ message: 'STT agent deleted successfully', id });
  } catch (error: any) {
    console.error('Error deleting STT agent:', error);
    return res.status(500).json({ error: 'Failed to delete STT agent' });
  }
});

export default router;
