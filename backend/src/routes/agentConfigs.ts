import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { DEFAULT_USER_ID, DEFAULT_TENANT_ID } from '../index';
import { apiKeyAuthOptional } from '../middleware/apiKeyAuth';

const router = Router();

router.use(apiKeyAuthOptional);

const getTenantId = (req: Request) => (req as any).tenantId || DEFAULT_TENANT_ID;

async function getUserIdForTenant(tenantId: string): Promise<string> {
  if (tenantId === DEFAULT_TENANT_ID) return DEFAULT_USER_ID;
  const member = await prisma.tenantMember.findFirst({
    where: { tenantId },
    include: { user: true }
  });
  if (member) return member.userId;

  const firstUser = await prisma.user.findFirst();
  if (firstUser) return firstUser.id;

  const dummy = await prisma.user.create({
    data: {
      email: `system-${tenantId}@voiceplatform.com`,
      officialEmail: `system-${tenantId}@voiceplatform.com`,
      firstName: 'System',
      lastName: 'Agent',
      passwordHash: 'dummy',
      tenantId
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

// Helpers for validation
const VALID_MODELS = ['gpt-4o', 'gpt-4o-mini'];

function flattenConfig(config: any) {
  if (!config) return null;
  const latestVersion = config.versions?.[0] || null;
  const { versions, ...rest } = config;
  if (!latestVersion) {
    return rest;
  }
  return {
    ...rest,
    latestVersionId: latestVersion.id,
    version: latestVersion.version,
    systemPrompt: latestVersion.systemPrompt,
    llmModel: latestVersion.llmModel,
    voicePreference: latestVersion.voicePreference,
    jobDescription: latestVersion.jobDescription,
    candidateResume: latestVersion.candidateResume,
    interviewPreferences: latestVersion.interviewPreferences,
    interviewDurationMinutes: latestVersion.interviewDurationMinutes,
    uploadedQuestions: latestVersion.uploadedQuestions,
    behaviorSettings: latestVersion.behaviorSettings,
    recordingEnabled: latestVersion.recordingEnabled
  };
}

// 1. Create agent config: POST /api/agent-configs
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      systemPrompt,
      llmModel,
      voicePreference,
      jobDescription,
      candidateResume,
      interviewPreferences,
      interviewDurationMinutes,
      uploadedQuestions,
      behaviorSettings,
      recordingEnabled,
      projectId: bodyProjectId
    } = req.body;

    // Validate required fields
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      res.status(400).json({ error: 'systemPrompt is required and must be a string.' });
      return;
    }

    if (!llmModel || !VALID_MODELS.includes(llmModel)) {
      res.status(400).json({ error: `llmModel must be one of: ${VALID_MODELS.join(', ')}` });
      return;
    }

    // Optional duration validation
    let parsedDuration: number | null = null;
    if (interviewDurationMinutes !== undefined && interviewDurationMinutes !== null) {
      parsedDuration = parseInt(interviewDurationMinutes, 10);
      if (isNaN(parsedDuration)) {
        res.status(400).json({ error: 'interviewDurationMinutes must be an integer.' });
        return;
      }
    }

    const tenantId = getTenantId(req);
    const userId = (req as any).userId || (await getUserIdForTenant(tenantId));

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

    const result = await prisma.$transaction(async (tx: any) => {
      // Create parent agent config
      const parent = await tx.agentConfig.create({
        data: {
          projectId,
          userId,
          name: name || null
        }
      });

      // Create version 1 entry
      const version = await tx.agentConfigVersion.create({
        data: {
          agentConfigId: parent.id,
          version: 1,
          systemPrompt,
          llmModel,
          voicePreference: voicePreference || null,
          jobDescription: jobDescription || null,
          candidateResume: candidateResume || null,
          interviewPreferences: interviewPreferences || null,
          interviewDurationMinutes: parsedDuration,
          uploadedQuestions: uploadedQuestions || null,
          behaviorSettings: behaviorSettings || null,
          recordingEnabled: recordingEnabled !== undefined ? !!recordingEnabled : false
        }
      });

      return { parent, version };
    });

    const response = {
      ...result.parent,
      latestVersionId: result.version.id,
      version: result.version.version,
      systemPrompt: result.version.systemPrompt,
      llmModel: result.version.llmModel,
      voicePreference: result.version.voicePreference,
      jobDescription: result.version.jobDescription,
      candidateResume: result.version.candidateResume,
      interviewPreferences: result.version.interviewPreferences,
      interviewDurationMinutes: result.version.interviewDurationMinutes,
      uploadedQuestions: result.version.uploadedQuestions,
      behaviorSettings: result.version.behaviorSettings,
      recordingEnabled: result.version.recordingEnabled
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// 2. Get all agent configs: GET /api/agent-configs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
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
    res.json(configs.map(flattenConfig));
  } catch (error) {
    next(error);
  }
});

// 3. Get single agent config by ID: GET /api/agent-configs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const config = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId: getTenantId(req) } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!config) {
      res.status(404).json({ error: 'Agent config not found.' });
      return;
    }

    res.json(flattenConfig(config));
  } catch (error) {
    next(error);
  }
});

// 4. Update agent config: PUT /api/agent-configs/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name,
      systemPrompt,
      llmModel,
      voicePreference,
      jobDescription,
      candidateResume,
      interviewPreferences,
      interviewDurationMinutes,
      uploadedQuestions,
      behaviorSettings,
      recordingEnabled
    } = req.body;

    // Verify config exists and fetch latest version
    const config = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId: getTenantId(req) } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!config) {
      res.status(404).json({ error: 'Agent config not found.' });
      return;
    }

    const latestVersion = config.versions[0];
    const newVersionNumber = latestVersion.version + 1;

    // Parse updated duration if present
    let parsedDuration: number | null | undefined = undefined;
    if (interviewDurationMinutes !== undefined) {
      if (interviewDurationMinutes === null) {
        parsedDuration = null;
      } else {
        parsedDuration = parseInt(interviewDurationMinutes, 10);
        if (isNaN(parsedDuration)) {
          res.status(400).json({ error: 'interviewDurationMinutes must be an integer.' });
          return;
        }
      }
    }

    // Merge missing fields using values from the latest version to prevent clearing data
    const mergedPrompt = systemPrompt !== undefined ? systemPrompt : latestVersion.systemPrompt;
    const mergedModel = llmModel !== undefined ? llmModel : latestVersion.llmModel;
    const mergedVoice = voicePreference !== undefined ? voicePreference : latestVersion.voicePreference;
    const mergedJD = jobDescription !== undefined ? jobDescription : latestVersion.jobDescription;
    const mergedResume = candidateResume !== undefined ? candidateResume : latestVersion.candidateResume;
    const mergedPrefs = interviewPreferences !== undefined ? interviewPreferences : latestVersion.interviewPreferences;
    const mergedDuration = parsedDuration !== undefined ? parsedDuration : latestVersion.interviewDurationMinutes;
    const mergedQuestions = uploadedQuestions !== undefined ? uploadedQuestions : latestVersion.uploadedQuestions;
    const mergedBehavior = behaviorSettings !== undefined ? behaviorSettings : latestVersion.behaviorSettings;
    const mergedRecording = recordingEnabled !== undefined ? !!recordingEnabled : latestVersion.recordingEnabled;

    // Validate merged requirements
    if (!mergedPrompt || typeof mergedPrompt !== 'string') {
      res.status(400).json({ error: 'systemPrompt cannot be empty and must be a string.' });
      return;
    }

    if (!mergedModel || !VALID_MODELS.includes(mergedModel)) {
      res.status(400).json({ error: `llmModel must be one of: ${VALID_MODELS.join(', ')}` });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Update parent config metadata/name and updatedAt timestamp
      const parent = await tx.agentConfig.update({
        where: { id },
        data: {
          name: name !== undefined ? name : undefined,
          updatedAt: new Date()
        }
      });

      // Create new version
      const version = await tx.agentConfigVersion.create({
        data: {
          agentConfigId: id,
          version: newVersionNumber,
          systemPrompt: mergedPrompt,
          llmModel: mergedModel,
          voicePreference: mergedVoice,
          jobDescription: mergedJD,
          candidateResume: mergedResume,
          interviewPreferences: mergedPrefs,
          interviewDurationMinutes: mergedDuration,
          uploadedQuestions: mergedQuestions,
          behaviorSettings: mergedBehavior,
          recordingEnabled: mergedRecording
        }
      });

      return { parent, version };
    });

    const response = {
      ...result.parent,
      latestVersionId: result.version.id,
      version: result.version.version,
      systemPrompt: result.version.systemPrompt,
      llmModel: result.version.llmModel,
      voicePreference: result.version.voicePreference,
      jobDescription: result.version.jobDescription,
      candidateResume: result.version.candidateResume,
      interviewPreferences: result.version.interviewPreferences,
      interviewDurationMinutes: result.version.interviewDurationMinutes,
      uploadedQuestions: result.version.uploadedQuestions,
      behaviorSettings: result.version.behaviorSettings,
      recordingEnabled: result.version.recordingEnabled
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// 5. Delete agent config: DELETE /api/agent-configs/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify config exists
    const existing = await prisma.agentConfig.findFirst({
      where: { id, project: { tenantId: getTenantId(req) } }
    });
    if (!existing) {
      res.status(404).json({ error: 'Agent config not found.' });
      return;
    }

    await prisma.agentConfig.delete({
      where: { id }
    });

    res.json({ message: 'Agent config successfully deleted.', id });
  } catch (error) {
    next(error);
  }
});

export default router;
