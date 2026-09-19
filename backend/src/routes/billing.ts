import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { sessionAuth } from '../middleware/sessionAuth';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();
router.use(sessionAuth);

// Helper function to extract pricing rates for an agent
function getAgentPricing(agent: any) {
  const config = (agent && agent.config as any) || {};
  if (agent.type === 'llm') {
    return {
      input_token_rate: typeof config.input_token_rate === 'number' ? config.input_token_rate : 250,
      output_token_rate: typeof config.output_token_rate === 'number' ? config.output_token_rate : 1000,
    };
  } else if (agent.type === 'stt') {
    return {
      rate_per_minute: typeof config.rate_per_minute === 'number' ? config.rate_per_minute : 0.80,
    };
  } else if (agent.type === 'tts') {
    return {
      rate_per_million_chars: typeof config.rate_per_million_chars === 'number' ? config.rate_per_million_chars : 1200,
    };
  }
  return {};
}

// Ensure default agents exist for a tenant if none exist yet
async function ensureDefaultAgentsForTenant(tenantId: string) {
  const count = await prisma.integrationAgent.count({ where: { tenantId } });
  if (count > 0) return;

  const defaultAgents = [
    {
      tenantId,
      type: 'stt',
      name: 'Deepgram Nova-3 STT Engine',
      providerVendor: 'deepgram',
      status: 'active',
      config: { rate_per_minute: 0.80 },
    },
    {
      tenantId,
      type: 'stt',
      name: 'OpenAI Whisper Realtime STT',
      providerVendor: 'openai',
      status: 'active',
      config: { rate_per_minute: 1.20 },
    },
    {
      tenantId,
      type: 'tts',
      name: 'ElevenLabs Neural Voice Synthesis',
      providerVendor: 'elevenlabs',
      status: 'active',
      config: { rate_per_million_chars: 1200 },
    },
    {
      tenantId,
      type: 'tts',
      name: 'OpenAI Alloy High-Definition TTS',
      providerVendor: 'openai',
      status: 'active',
      config: { rate_per_million_chars: 800 },
    },
    {
      tenantId,
      type: 'llm',
      name: 'OpenAI GPT-4o Conversational Agent',
      providerVendor: 'openai',
      status: 'active',
      config: { input_token_rate: 250, output_token_rate: 1000 },
    },
    {
      tenantId,
      type: 'llm',
      name: 'Anthropic Claude 3.5 Sonnet Reasoning Agent',
      providerVendor: 'anthropic',
      status: 'active',
      config: { input_token_rate: 300, output_token_rate: 1200 },
    },
  ];

  for (const agent of defaultAgents) {
    try {
      await prisma.integrationAgent.create({ data: agent });
    } catch (err) {
      // Ignore unique key conflict if race condition
    }
  }
}

// 1. GET /api/subscription-plans & /api/billing/subscription-plans — List active plans
router.get(['/', '/plans', '/subscription-plans'], requirePermission('billing:view'), async (req: Request, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { platformFee: 'asc' },
    });

    const mapped = plans.map((p) => ({
      id: p.id,
      name: p.name,
      platformFee: Number(p.platformFee),
      description: p.description,
      isActive: p.isActive,
    }));

    return res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching subscription plans:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// 2. GET /api/billing/subscription — Requesting org's current active subscription
router.get('/subscription', requirePermission('billing:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const sub = await prisma.organizationSubscription.findFirst({
      where: { tenantId, status: 'active' },
      include: {
        plan: true,
        llmAgent: true,
        sttAgent: true,
        ttsAgent: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      return res.json(null);
    }

    const planFee = Number(sub.plan.platformFee);
    const llmPricing = getAgentPricing(sub.llmAgent);
    const sttPricing = getAgentPricing(sub.sttAgent);
    const ttsPricing = getAgentPricing(sub.ttsAgent);

    const inputTokens = Number(sub.estimatedInputTokensPerMonth);
    const outputTokens = Number(sub.estimatedOutputTokensPerMonth);
    const sttMinutes = Number(sub.estimatedSttMinutesPerMonth);
    const ttsChars = Number(sub.estimatedTtsCharsPerMonth);

    const aiCost =
      (inputTokens / 1_000_000) * (llmPricing.input_token_rate || 250) +
      (outputTokens / 1_000_000) * (llmPricing.output_token_rate || 1000);
    const sttCost = sttMinutes * (sttPricing.rate_per_minute || 0.80);
    const ttsCost = (ttsChars / 1_000_000) * (ttsPricing.rate_per_million_chars || 1200);
    const total = aiCost + sttCost + ttsCost + planFee;

    return res.json({
      id: sub.id,
      tenantId: sub.tenantId,
      status: sub.status,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        platformFee: planFee,
        description: sub.plan.description,
      },
      llmAgent: sub.llmAgent
        ? {
            id: sub.llmAgent.id,
            name: sub.llmAgent.name,
            providerVendor: sub.llmAgent.providerVendor,
            ...llmPricing,
          }
        : null,
      sttAgent: sub.sttAgent
        ? {
            id: sub.sttAgent.id,
            name: sub.sttAgent.name,
            providerVendor: sub.sttAgent.providerVendor,
            ...sttPricing,
          }
        : null,
      ttsAgent: sub.ttsAgent
        ? {
            id: sub.ttsAgent.id,
            name: sub.ttsAgent.name,
            providerVendor: sub.ttsAgent.providerVendor,
            ...ttsPricing,
          }
        : null,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedSttMinutes: sttMinutes,
      estimatedTtsChars: ttsChars,
      aiCost: Math.round(aiCost * 100) / 100,
      sttCost: Math.round(sttCost * 100) / 100,
      ttsCost: Math.round(ttsCost * 100) / 100,
      platformFee: planFee,
      total: Math.round(total * 100) / 100,
      createdAt: sub.createdAt?.toISOString(),
      updatedAt: sub.updatedAt?.toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching current subscription:', error);
    return res.status(500).json({ error: 'Failed to fetch current subscription' });
  }
});

// 3. GET /api/billing/agent-options — Returns tenant's STT/TTS/LLM agents with pricing fields
router.get('/agent-options', requirePermission('billing:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    await ensureDefaultAgentsForTenant(tenantId);

    const agents = await prisma.integrationAgent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const sttAgents = agents
      .filter((a) => a.type === 'stt')
      .map((a) => ({
        id: a.id,
        name: a.name,
        providerVendor: a.providerVendor,
        status: a.status,
        ...getAgentPricing(a),
      }));

    const ttsAgents = agents
      .filter((a) => a.type === 'tts')
      .map((a) => ({
        id: a.id,
        name: a.name,
        providerVendor: a.providerVendor,
        status: a.status,
        ...getAgentPricing(a),
      }));

    const llmAgents = agents
      .filter((a) => a.type === 'llm')
      .map((a) => ({
        id: a.id,
        name: a.name,
        providerVendor: a.providerVendor,
        status: a.status,
        ...getAgentPricing(a),
      }));

    return res.json({ sttAgents, ttsAgents, llmAgents });
  } catch (error: any) {
    console.error('Error fetching agent options:', error);
    return res.status(500).json({ error: 'Failed to fetch agent options' });
  }
});

// 4. POST /api/billing/estimate — Calculate authoritative cost breakdown
router.post('/estimate', requirePermission('billing:view'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const {
      planId,
      llmAgentId,
      sttAgentId,
      ttsAgentId,
      estimatedInputTokens = 0,
      estimatedOutputTokens = 0,
      estimatedSttMinutes = 0,
      estimatedTtsChars = 0,
    } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Missing required field: planId' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Selected subscription plan not found or inactive' });
    }

    let llmAgent: any = null;
    let sttAgent: any = null;
    let ttsAgent: any = null;

    if (llmAgentId) {
      llmAgent = await prisma.integrationAgent.findFirst({
        where: { id: llmAgentId, tenantId, type: 'llm' },
      });
      if (!llmAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: LLM agent not found for this tenant' });
      }
    }

    if (sttAgentId) {
      sttAgent = await prisma.integrationAgent.findFirst({
        where: { id: sttAgentId, tenantId, type: 'stt' },
      });
      if (!sttAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: STT agent not found for this tenant' });
      }
    }

    if (ttsAgentId) {
      ttsAgent = await prisma.integrationAgent.findFirst({
        where: { id: ttsAgentId, tenantId, type: 'tts' },
      });
      if (!ttsAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: TTS agent not found for this tenant' });
      }
    }

    const llmPricing = getAgentPricing(llmAgent);
    const sttPricing = getAgentPricing(sttAgent);
    const ttsPricing = getAgentPricing(ttsAgent);

    const inputTokens = Number(estimatedInputTokens) || 0;
    const outputTokens = Number(estimatedOutputTokens) || 0;
    const sttMinutes = Number(estimatedSttMinutes) || 0;
    const ttsChars = Number(estimatedTtsChars) || 0;
    const platformFee = Number(plan.platformFee);

    const aiCost =
      (inputTokens / 1_000_000) * (llmPricing.input_token_rate || 250) +
      (outputTokens / 1_000_000) * (llmPricing.output_token_rate || 1000);
    const sttCost = sttMinutes * (sttPricing.rate_per_minute || 0.80);
    const ttsCost = (ttsChars / 1_000_000) * (ttsPricing.rate_per_million_chars || 1200);
    const total = aiCost + sttCost + ttsCost + platformFee;

    return res.json({
      planId: plan.id,
      planName: plan.name,
      platformFee,
      aiCost: Math.round(aiCost * 100) / 100,
      sttCost: Math.round(sttCost * 100) / 100,
      ttsCost: Math.round(ttsCost * 100) / 100,
      total: Math.round(total * 100) / 100,
      details: {
        llmAgentName: llmAgent ? llmAgent.name : null,
        sttAgentName: sttAgent ? sttAgent.name : null,
        ttsAgentName: ttsAgent ? ttsAgent.name : null,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedSttMinutes: sttMinutes,
        estimatedTtsChars: ttsChars,
      },
    });
  } catch (error: any) {
    console.error('Error calculating estimate:', error);
    return res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

// 5. POST /api/billing/subscribe — Create or replace tenant subscription
router.post('/subscribe', requirePermission('billing:edit'), async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant context' });
    }

    const {
      planId,
      llmAgentId,
      sttAgentId,
      ttsAgentId,
      estimatedInputTokens = 0,
      estimatedOutputTokens = 0,
      estimatedSttMinutes = 0,
      estimatedTtsChars = 0,
    } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Missing required field: planId' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Selected subscription plan not found or inactive' });
    }

    let llmAgent: any = null;
    let sttAgent: any = null;
    let ttsAgent: any = null;

    if (llmAgentId) {
      llmAgent = await prisma.integrationAgent.findFirst({
        where: { id: llmAgentId, tenantId, type: 'llm' },
      });
      if (!llmAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: LLM agent not found for this tenant' });
      }
    }

    if (sttAgentId) {
      sttAgent = await prisma.integrationAgent.findFirst({
        where: { id: sttAgentId, tenantId, type: 'stt' },
      });
      if (!sttAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: STT agent not found for this tenant' });
      }
    }

    if (ttsAgentId) {
      ttsAgent = await prisma.integrationAgent.findFirst({
        where: { id: ttsAgentId, tenantId, type: 'tts' },
      });
      if (!ttsAgent) {
        return res.status(403).json({ error: 'Unauthorized agent selection: TTS agent not found for this tenant' });
      }
    }

    // Deactivate any existing active subscriptions for this tenant
    await prisma.organizationSubscription.updateMany({
      where: { tenantId, status: 'active' },
      data: { status: 'cancelled' },
    });

    // Create the new active subscription
    const sub = await prisma.organizationSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        llmAgentId: llmAgentId || null,
        sttAgentId: sttAgentId || null,
        ttsAgentId: ttsAgentId || null,
        estimatedInputTokensPerMonth: BigInt(Math.max(0, Math.floor(Number(estimatedInputTokens) || 0))),
        estimatedOutputTokensPerMonth: BigInt(Math.max(0, Math.floor(Number(estimatedOutputTokens) || 0))),
        estimatedSttMinutesPerMonth: Math.max(0, Math.floor(Number(estimatedSttMinutes) || 0)),
        estimatedTtsCharsPerMonth: BigInt(Math.max(0, Math.floor(Number(estimatedTtsChars) || 0))),
        status: 'active',
      },
      include: {
        plan: true,
        llmAgent: true,
        sttAgent: true,
        ttsAgent: true,
      },
    });

    const planFee = Number(sub.plan.platformFee);
    const llmPricing = getAgentPricing(sub.llmAgent);
    const sttPricing = getAgentPricing(sub.sttAgent);
    const ttsPricing = getAgentPricing(sub.ttsAgent);

    const inputTokens = Number(sub.estimatedInputTokensPerMonth);
    const outputTokens = Number(sub.estimatedOutputTokensPerMonth);
    const sttMinutes = Number(sub.estimatedSttMinutesPerMonth);
    const ttsChars = Number(sub.estimatedTtsCharsPerMonth);

    const aiCost =
      (inputTokens / 1_000_000) * (llmPricing.input_token_rate || 250) +
      (outputTokens / 1_000_000) * (llmPricing.output_token_rate || 1000);
    const sttCost = sttMinutes * (sttPricing.rate_per_minute || 0.80);
    const ttsCost = (ttsChars / 1_000_000) * (ttsPricing.rate_per_million_chars || 1200);
    const total = aiCost + sttCost + ttsCost + planFee;

    return res.status(201).json({
      message: 'Subscription created successfully',
      subscription: {
        id: sub.id,
        tenantId: sub.tenantId,
        status: sub.status,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          platformFee: planFee,
          description: sub.plan.description,
        },
        llmAgent: sub.llmAgent
          ? {
              id: sub.llmAgent.id,
              name: sub.llmAgent.name,
              providerVendor: sub.llmAgent.providerVendor,
              ...llmPricing,
            }
          : null,
        sttAgent: sub.sttAgent
          ? {
              id: sub.sttAgent.id,
              name: sub.sttAgent.name,
              providerVendor: sub.sttAgent.providerVendor,
              ...sttPricing,
            }
          : null,
        ttsAgent: sub.ttsAgent
          ? {
              id: sub.ttsAgent.id,
              name: sub.ttsAgent.name,
              providerVendor: sub.ttsAgent.providerVendor,
              ...ttsPricing,
            }
          : null,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedSttMinutes: sttMinutes,
        estimatedTtsChars: ttsChars,
        aiCost: Math.round(aiCost * 100) / 100,
        sttCost: Math.round(sttCost * 100) / 100,
        ttsCost: Math.round(ttsCost * 100) / 100,
        platformFee: planFee,
        total: Math.round(total * 100) / 100,
        createdAt: sub.createdAt?.toISOString(),
        updatedAt: sub.updatedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
});

export default router;
