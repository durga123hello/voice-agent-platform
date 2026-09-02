import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '../index';
import { apiKeyAuthOptional } from '../middleware/apiKeyAuth';
import { resolveUtteranceEndMs } from '../utils/promptPacing';

const router = Router();

router.use(apiKeyAuthOptional);

async function getUserIdForTenant(tenantId: string): Promise<string> {
  if (tenantId === DEFAULT_TENANT_ID) return DEFAULT_USER_ID;
  const user = await prisma.user.findFirst({
    where: {
      memberships: {
        some: { tenantId }
      }
    }
  });
  if (user) return user.id;

  const firstUser = await prisma.user.findFirst();
  if (firstUser) return firstUser.id;

  const dummy = await prisma.user.create({
    data: {
      email: `system-${tenantId}@voiceplatform.com`,
      passwordHash: 'dummy'
    }
  });
  await prisma.tenantMember.create({
    data: {
      userId: dummy.id,
      tenantId,
      role: 'member'
    }
  });
  return dummy.id;
}

function formatAssistantResponse(config: any, version: any) {
  return {
    id: config.id,
    name: config.name,
    projectId: config.projectId,
    version: version.version,
    systemPrompt: version.systemPrompt,
    llmModel: version.llmModel,
    voicePreference: version.voicePreference,
    firstMessage: version.firstMessage,
    transcriberConfig: version.transcriberConfig,
    recordingEnabled: version.recordingEnabled,
    silenceTimeoutSeconds: version.silenceTimeoutSeconds,
    utteranceEndMs: version.utteranceEndMs,
    analysisPlan: version.analysisPlan,
    customContext: version.customContext,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

/**
 * 1. Create Assistant: POST /v1/assistants (or /api/v1/assistants)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
    const userId = (req as any).userId || (await getUserIdForTenant(tenantId));

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
      utteranceEndMs,
      context,
      projectId: bodyProjectId
    } = req.body;

    // Validate payload
    if (!model || !model.messages || !Array.isArray(model.messages) || model.messages.length === 0) {
      res.status(400).json({ error: 'model.messages is required and must contain at least one system message.' });
      return;
    }

    // Resolve project ID (from API key, body, or fallback to tenant's first project)
    let projectId = (req as any).projectId || bodyProjectId;
    if (!projectId) {
      const firstProj = await prisma.project.findFirst({ where: { tenantId } });
      if (!firstProj) {
        res.status(400).json({ error: 'No projects found. Create a project first.' });
        return;
      }
      projectId = firstProj.id;
    } else {
      const proj = await prisma.project.findFirst({ where: { id: projectId, tenantId } });
      if (!proj) {
        res.status(404).json({ error: 'Project not found or unauthorized' });
        return;
      }
    }

    const systemPrompt = model.messages[0].content;
    const llmModel = model.model || 'gpt-4o-mini';
    const voicePreference = voice ? voice.voiceId : null;
    const resolvedPacing = resolveUtteranceEndMs(
      utteranceEndMs || transcriber?.utteranceEndMs,
      systemPrompt
    );

    // Create AgentConfig row
    const config = await prisma.agentConfig.create({
      data: {
        projectId,
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
        transcriberConfig: transcriber ? { ...transcriber, utteranceEndMs: resolvedPacing } : { utteranceEndMs: resolvedPacing },
        recordingEnabled: !!recordingEnabled,
        silenceTimeoutSeconds: silenceTimeoutSeconds ? parseInt(silenceTimeoutSeconds, 10) : null,
        analysisPlan: analysisPlan || null,
        customContext: context || null,
        utteranceEndMs: resolvedPacing
      }
    });

    res.status(201).json(formatAssistantResponse(config, version));
  } catch (error) {
    next(error);
  }
});

/**
 * 2. List Assistants: GET /v1/assistants (or /api/v1/assistants)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
    const { projectId } = req.query;

    let whereClause: any = { project: { tenantId } };
    if (projectId && typeof projectId === 'string') {
      whereClause = { projectId, project: { tenantId } };
    }

    const configs = await prisma.agentConfig.findMany({
      where: whereClause,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const response = configs.map((c: any) => formatAssistantResponse(c, c.versions[0] || {}));
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * 3. Retrieve Single Assistant: GET /v1/assistants/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
    const { id } = req.params;

    const config = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!config) {
      res.status(404).json({ error: 'Assistant not found.' });
      return;
    }

    res.json(formatAssistantResponse(config, config.versions[0] || {}));
  } catch (error) {
    next(error);
  }
});

/**
 * 4. Update Assistant: PATCH /v1/assistants/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
    const { id } = req.params;
    const {
      name,
      firstMessage,
      transcriber,
      voice,
      model,
      analysisPlan,
      recordingEnabled,
      silenceTimeoutSeconds,
      utteranceEndMs,
      context
    } = req.body;

    const config = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!config) {
      res.status(404).json({ error: 'Assistant not found.' });
      return;
    }

    const latest = config.versions[0];
    const newVersionNumber = latest.version + 1;

    const mergedPrompt = model?.messages?.[0]?.content || latest.systemPrompt;
    const mergedModel = model?.model || latest.llmModel;
    const mergedVoice = voice?.voiceId !== undefined ? voice.voiceId : latest.voicePreference;
    const mergedFirstMsg = firstMessage !== undefined ? firstMessage : latest.firstMessage;
    const mergedTranscriber = transcriber !== undefined ? transcriber : latest.transcriberConfig;
    const mergedRecording = recordingEnabled !== undefined ? !!recordingEnabled : latest.recordingEnabled;
    const mergedTimeout = silenceTimeoutSeconds !== undefined ? (silenceTimeoutSeconds ? parseInt(silenceTimeoutSeconds, 10) : null) : latest.silenceTimeoutSeconds;
    const mergedAnalysis = analysisPlan !== undefined ? analysisPlan : latest.analysisPlan;
    const mergedContext = context !== undefined ? context : latest.customContext;
    const mergedPacing = resolveUtteranceEndMs(
      utteranceEndMs || transcriber?.utteranceEndMs || latest.utteranceEndMs,
      mergedPrompt
    );

    const [updatedParent, newVersion] = await prisma.$transaction([
      prisma.agentConfig.update({
        where: { id },
        data: {
          name: name !== undefined ? name : config.name,
          updatedAt: new Date()
        }
      }),
      prisma.agentConfigVersion.create({
        data: {
          agentConfigId: id,
          version: newVersionNumber,
          systemPrompt: mergedPrompt,
          llmModel: mergedModel,
          voicePreference: mergedVoice,
          firstMessage: mergedFirstMsg,
          transcriberConfig: mergedTranscriber,
          recordingEnabled: mergedRecording,
          silenceTimeoutSeconds: mergedTimeout,
          analysisPlan: mergedAnalysis,
          customContext: mergedContext,
          utteranceEndMs: mergedPacing
        }
      })
    ]);

    res.json(formatAssistantResponse(updatedParent, newVersion));
  } catch (error) {
    next(error);
  }
});

/**
 * 5. Delete Assistant: DELETE /v1/assistants/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || DEFAULT_TENANT_ID;
    const { id } = req.params;

    const existing = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId } }
    });

    if (!existing) {
      res.status(404).json({ error: 'Assistant not found.' });
      return;
    }

    await prisma.agentConfig.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Assistant successfully deleted.',
      id
    });
  } catch (error) {
    next(error);
  }
});

export default router;
