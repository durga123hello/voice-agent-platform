import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { endSessionPipeline } from '../services/signaling';
import { DEFAULT_TENANT_ID } from '../index';

const router = Router();

// Fetch all sessions: GET /api/sessions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { tenantId: DEFAULT_TENANT_ID },
      orderBy: { startedAt: 'desc' },
      include: {
        agentConfigVersion: {
          include: {
            agentConfig: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const formatted = sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      status: s.status,
      summary: s.summary,
      tenantId: s.tenantId,
      agentConfig: {
        name: s.agentConfigVersion.agentConfig.name
      }
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// Create session: POST /api/sessions
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentConfigId } = req.body;

    if (!agentConfigId || typeof agentConfigId !== 'string') {
      res.status(400).json({ error: 'agentConfigId is required.' });
      return;
    }

    // Verify agent config exists and find latest version
    const latestVersion = await prisma.agentConfigVersion.findFirst({
      where: {
        agentConfigId,
        agentConfig: {
          tenantId: DEFAULT_TENANT_ID
        }
      },
      orderBy: { version: 'desc' }
    });

    if (!latestVersion) {
      res.status(404).json({ error: 'Agent config or its version not found.' });
      return;
    }

    // Create session in database linking to latest version
    const session = await prisma.session.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        agentConfigVersionId: latestVersion.id,
        status: 'active'
      }
    });

    res.status(201).json({
      id: session.id,
      status: session.status,
      agentConfigVersionId: session.agentConfigVersionId,
      startedAt: session.startedAt,
      wsToken: `token-${session.id}` // Placeholder WS token as specified by API spec
    });
  } catch (error) {
    next(error);
  }
});

// Fetch transcripts for completed sessions: GET /api/sessions/:id/transcript
router.get('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify session belongs to default tenant
    const session = await prisma.session.findFirst({
      where: { id, tenantId: DEFAULT_TENANT_ID }
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Update session state (complete/abort): PATCH /api/sessions/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, summary } = req.body;

    if (status && !['active', 'completed', 'aborted'].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be 'active', 'completed', or 'aborted'." });
      return;
    }

    // Verify session belongs to tenant
    const existing = await prisma.session.findFirst({
      where: { id, tenantId: DEFAULT_TENANT_ID }
    });

    if (!existing) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const session = await prisma.session.update({
      where: { id },
      data: {
        status: status || undefined,
        summary: summary || undefined,
        endedAt: (status === 'completed' || status === 'aborted') ? new Date() : undefined
      }
    });

    res.json(session);
  } catch (error) {
    next(error);
  }
});

// End session: POST /api/sessions/:id/end
router.post('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify session exists and belongs to tenant
    const session = await prisma.session.findFirst({
      where: { id, tenantId: DEFAULT_TENANT_ID }
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Update session status to completed
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });

    // Terminate all real-time pipelines and resources
    await endSessionPipeline(id);

    res.json(updatedSession);
  } catch (error) {
    next(error);
  }
});

export default router;
