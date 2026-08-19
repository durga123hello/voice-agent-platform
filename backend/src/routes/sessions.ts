import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { endSessionPipeline } from '../services/signaling';
import { DEFAULT_TENANT_ID } from '../index';
import { apiKeyAuthOptional } from '../middleware/apiKeyAuth';
import { updateSessionState, mapErrorCodeToUserMessage } from '../services/transports/lifecycle';

const router = Router();

router.use(apiKeyAuthOptional);

const getTenantId = (req: Request) => (req as any).tenantId || DEFAULT_TENANT_ID;

// Fetch all sessions: GET /api/sessions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { tenantId: getTenantId(req) },
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

    const formatted = sessions.map((s: any) => ({
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
    const { agentConfigId, transport, phoneNumber } = req.body;

    if (!agentConfigId || typeof agentConfigId !== 'string') {
      res.status(400).json({ error: 'agentConfigId is required.' });
      return;
    }

    if (transport && !['webrtc', 'plivo'].includes(transport)) {
      res.status(400).json({ error: "Invalid transport. Must be 'webrtc' or 'plivo'." });
      return;
    }

    // Verify agent config exists and find latest version
    const latestVersion = await prisma.agentConfigVersion.findFirst({
      where: {
        agentConfigId,
        agentConfig: {
          tenantId: getTenantId(req)
        }
      },
      orderBy: { version: 'desc' }
    });

    if (!latestVersion) {
      res.status(404).json({ error: 'Agent config or its version not found.' });
      return;
    }

    const resolvedTransport = transport || 'webrtc';

    // Create session in database linking to latest version
    const session = await prisma.session.create({
      data: {
        tenantId: getTenantId(req),
        agentConfigVersionId: latestVersion.id,
        status: 'active',
        transport: resolvedTransport,
        phoneNumber: phoneNumber || null,
        callState: resolvedTransport === 'webrtc' ? 'connected' : 'initiating',
        mediaState: resolvedTransport === 'webrtc' ? 'connecting' : 'disconnected',
        conversationState: 'idle'
      }
    });

    res.status(201).json({
      id: session.id,
      status: session.status,
      agentConfigVersionId: session.agentConfigVersionId,
      startedAt: session.startedAt,
      transport: session.transport,
      phoneNumber: session.phoneNumber,
      wsToken: `token-${session.id}` // Placeholder WS token as specified by API spec
    });
  } catch (error) {
    next(error);
  }
});

// Create outbound Plivo call: POST /api/sessions/outbound
router.post('/outbound', async (req: Request, res: Response, next: NextFunction) => {
  let session: any;
  try {
    const { agentConfigId, phoneNumber } = req.body;

    if (!agentConfigId || typeof agentConfigId !== 'string') {
      res.status(400).json({ error: 'agentConfigId is required.' });
      return;
    }
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ error: 'phoneNumber is required.' });
      return;
    }

    // Phone number format validation (E.164-like check: at least 7 digits, no invalid chars)
    const cleanPhone = phoneNumber.replace(/[+\s-]/g, '');
    if (!/^\d{7,15}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Invalid phone number format. Must contain between 7 and 15 digits.' });
      return;
    }

    // Verify agent config exists and find latest version
    const latestVersion = await prisma.agentConfigVersion.findFirst({
      where: {
        agentConfigId,
        agentConfig: {
          tenantId: getTenantId(req)
        }
      },
      orderBy: { version: 'desc' }
    });

    if (!latestVersion) {
      res.status(404).json({ error: 'Agent config or its version not found.' });
      return;
    }

    // Prevent duplicate active calls to the same number
    const existingActive = await prisma.session.findFirst({
      where: {
        phoneNumber,
        status: 'active',
        transport: 'plivo'
      }
    });

    if (existingActive) {
      console.warn(`[Sessions Outbound] Call already active for number ${phoneNumber}. Rejecting duplicate request.`);
      res.status(409).json({ error: 'A call is already active for this phone number.' });
      return;
    }

    // Create session in database
    session = await prisma.session.create({
      data: {
        tenantId: getTenantId(req),
        agentConfigVersionId: latestVersion.id,
        status: 'active',
        transport: 'plivo',
        phoneNumber,
        callState: 'initiating',
        mediaState: 'disconnected',
        conversationState: 'idle'
      }
    });

    // Get Plivo configuration
    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const fromNumber = process.env.PLIVO_FROM_NUMBER;
    const answerUrlBase = process.env.PLIVO_ANSWER_URL_BASE;

    if (!authId || !authToken || !fromNumber || !answerUrlBase) {
      const errMsg = 'Plivo is not fully configured in the server environment (missing AUTH_ID, AUTH_TOKEN, FROM_NUMBER or ANSWER_URL_BASE).';
      await updateSessionState(session.id, {
        callState: 'failed',
        errorCode: 'CALL_PROVIDER_ERROR',
        errorMessage: errMsg
      });
      res.status(500).json({ error: errMsg });
      return;
    }

    // Trigger Outbound Call via Plivo API
    const answerUrl = `${answerUrlBase}/api/telephony/plivo/answer/${session.id}`;
    const callbackUrl = `${answerUrlBase}/api/telephony/plivo/status/${session.id}`;
    const plivoUrl = `https://api.plivo.com/v1/Account/${authId}/Call/`;
    const authString = Buffer.from(`${authId}:${authToken}`).toString('base64');

    console.log(`[Plivo Outbound] Dispatching call to ${phoneNumber} with answer_url=${answerUrl} and callback_url=${callbackUrl}`);

    const { PLIVO_API_MAX_RETRIES } = require('../services/transports/lifecycle');

    let plivoRes: any = null;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < PLIVO_API_MAX_RETRIES) {
      try {
        console.log(`[Plivo Outbound] Dispatching call attempt ${attempt + 1}/${PLIVO_API_MAX_RETRIES}...`);
        plivoRes = await fetch(plivoUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromNumber,
            to: phoneNumber,
            answer_url: answerUrl,
            answer_method: 'POST',
            callback_url: callbackUrl,
            callback_method: 'POST'
          })
        });

        if (plivoRes.ok) {
          break;
        }

        const status = plivoRes.status;
        const responseText = await plivoRes.clone().text();
        console.warn(`[Plivo Outbound Attempt Failed] HTTP Status: ${status}, Response: ${responseText}`);

        if (status === 400 || status === 401 || status === 403 || status === 404) {
          console.error(`[Plivo Outbound] Permanent API error ${status}. Aborting retries.`);
          lastError = new Error(`Plivo API returned permanent status ${status}: ${responseText}`);
          break;
        }

        lastError = new Error(`Plivo API returned transient status ${status}: ${responseText}`);
      } catch (err: any) {
        console.warn(`[Plivo Outbound Attempt Error] Network/fetch error:`, err);
        lastError = err;
      }

      attempt++;
      if (attempt < PLIVO_API_MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 500;
        console.log(`[Plivo Outbound] Backing off for ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!plivoRes || !plivoRes.ok) {
      const finalErr = lastError || new Error(`Plivo trigger ultimately failed after ${PLIVO_API_MAX_RETRIES} attempts.`);
      throw finalErr;
    }

    const responseText = await plivoRes.text();
    const parsedPlivo = JSON.parse(responseText);

    const callUuid = parsedPlivo.request_uuid || '';

    // Update session state to ringing upon successful trigger
    await updateSessionState(session.id, {
      providerCallId: callUuid,
      callState: 'ringing'
    });

    res.status(201).json({
      id: session.id,
      status: 'active',
      startedAt: session.startedAt,
      plivoResponse: parsedPlivo
    });
  } catch (error: any) {
    console.error('[Plivo Outbound Error] Failed to trigger call:', error);
    if (session) {
      await updateSessionState(session.id, {
        callState: 'failed',
        errorCode: 'CALL_PROVIDER_ERROR',
        errorMessage: error?.message || 'Plivo API trigger failed'
      });
    }
    next(error);
  }
});


// Fetch transcripts for completed sessions: GET /api/sessions/:id/transcript
router.get('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verify session belongs to default tenant
    const session = await prisma.session.findFirst({
      where: { id, tenantId: getTenantId(req) }
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' }
    });

    const events = await prisma.sessionEvent.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' }
    });

    const turnLatencies = events.filter((e: any) => e.eventType === 'turn_latency');
    const tokenUsages = events.filter((e: any) => e.eventType === 'token_usage');

    let assistantIndex = 0;
    const enrichedMessages = messages.map((m: any) => {
      if (m.role === 'assistant') {
        const latency = turnLatencies[assistantIndex]?.metadata || null;
        const usage = tokenUsages[assistantIndex]?.metadata || null;
        assistantIndex++;
        return {
          ...m,
          latency,
          usage
        };
      }
      return m;
    });

    res.json(enrichedMessages);
  } catch (error) {
    next(error);
  }
});

// Update session state (complete/abort): PATCH /api/sessions/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, summary } = req.body;

    const DETAILED_STATUSES = [
      'initiating', 'ringing', 'connected', 'in_progress', 'completed',
      'no_answer', 'busy', 'rejected', 'callback_requested', 'user_hangup',
      'ai_hangup', 'unexpected_disconnect', 'failed', 'cancelled', 'timeout',
      'active', 'aborted'
    ];

    if (status && !DETAILED_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${DETAILED_STATUSES.join(', ')}` });
      return;
    }

    // Verify session belongs to tenant
    const existing = await prisma.session.findFirst({
      where: { id, tenantId: getTenantId(req) }
    });

    if (!existing) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const activeStatuses = ['active', 'initiating', 'ringing', 'connected', 'in_progress'];
    const abortedTerminal = ['aborted', 'no_answer', 'busy', 'rejected', 'callback_requested', 'unexpected_disconnect', 'failed', 'cancelled', 'timeout'];

    if (status && abortedTerminal.includes(status) && activeStatuses.includes(existing.status)) {
      const sessionMessages = await prisma.message.findMany({
        where: { sessionId: id, role: 'assistant' }
      });
      const elapsed = Date.now() - (existing.startedAt ? existing.startedAt.getTime() : Date.now());
      const turnCount = sessionMessages.length;

      await prisma.sessionEvent.create({
        data: {
          sessionId: id,
          eventType: 'abort',
          metadata: {
            abortedAtTurn: turnCount,
            elapsedTimeMs: elapsed
          }
        }
      }).catch((dbErr: any) => console.error('[Database Log Error] Failed to log abort event:', dbErr));
      console.log(`[PATCH Session Aborted] Logged abort event for session ${id} at turn ${turnCount} after ${elapsed}ms.`);
    }

    const completedTerminal = ['completed', 'user_hangup', 'ai_hangup'];
    const isTerminal = status && (completedTerminal.includes(status) || abortedTerminal.includes(status));

    const session = await prisma.session.update({
      where: { id },
      data: {
        status: status || undefined,
        summary: summary || undefined,
        endedAt: isTerminal ? new Date() : undefined
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
      where: { id, tenantId: getTenantId(req) }
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

// Fetch single session detail: GET /api/sessions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const session = await prisma.session.findFirst({
      where: { id, tenantId: getTenantId(req) },
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

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    res.json({
      id: session.id,
      tenantId: session.tenantId,
      status: session.status,
      transport: session.transport,
      phoneNumber: session.phoneNumber,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      providerCallId: session.providerCallId,
      callState: session.callState,
      mediaState: session.mediaState,
      conversationState: session.conversationState,
      endedReason: session.endedReason,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
      userMessage: session.userMessage,
      lastActivityAt: session.lastActivityAt,
      agentConfig: {
        name: session.agentConfigVersion.agentConfig.name
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
