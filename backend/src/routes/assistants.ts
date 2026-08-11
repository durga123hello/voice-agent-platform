import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();

// Endpoint gate: requires API Key Auth
router.use(apiKeyAuth);

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

async function getUserIdForTenant(tenantId: string): Promise<string> {
  if (tenantId === DEFAULT_TENANT_ID) return DEFAULT_USER_ID;
  const user = await prisma.user.findFirst({ where: { tenantId } });
  if (user) return user.id;
  const dummy = await prisma.user.create({
    data: {
      email: `system-${tenantId}@voiceplatform.com`,
      passwordHash: 'dummy',
      tenantId
    }
  });
  return dummy.id;
}

/**
 * POST /api/v1/assistants
 * Single-call assistant creation endpoint.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = await getUserIdForTenant(tenantId);

    const {
      name,
      firstMessage,
      transcriber,
      voice,
      model,
      analysisPlan,
      recordingEnabled,
      maxDurationSeconds,
      silenceTimeoutSeconds,
      context
    } = req.body;

    // Validate payload
    if (!model || !model.messages || !Array.isArray(model.messages) || model.messages.length === 0) {
      res.status(400).json({ error: 'model.messages is required and must contain at least one system message.' });
      return;
    }

    const systemPrompt = model.messages[0].content;
    const llmModel = model.model || 'gpt-4o-mini';
    const voicePreference = voice ? voice.voiceId : null;

    // Create AgentConfig row
    const config = await prisma.agentConfig.create({
      data: {
        tenantId,
        userId,
        name: name || null
      }
    });

    // Create AgentConfigVersion row
    const version = await prisma.agentConfigVersion.create({
      data: {
        agentConfigId: config.id,
        version: 1,
        systemPrompt,
        llmModel,
        voicePreference,
        firstMessage: firstMessage || null,
        transcriberConfig: transcriber || null,
        recordingEnabled: !!recordingEnabled,
        silenceTimeoutSeconds: silenceTimeoutSeconds ? parseInt(silenceTimeoutSeconds, 10) : null,
        analysisPlan: analysisPlan || null,
        customContext: context || null
      }
    });

    res.status(201).json({
      id: config.id,
      name: config.name,
      version: version.version,
      systemPrompt: version.systemPrompt,
      llmModel: version.llmModel,
      firstMessage: version.firstMessage,
      transcriberConfig: version.transcriberConfig,
      recordingEnabled: version.recordingEnabled,
      silenceTimeoutSeconds: version.silenceTimeoutSeconds,
      analysisPlan: version.analysisPlan,
      customContext: version.customContext
    });
  } catch (error) {
    next(error);
  }
});

export default router;
