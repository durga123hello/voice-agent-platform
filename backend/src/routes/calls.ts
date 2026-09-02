import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { DEFAULT_TENANT_ID } from '../index';
import { apiKeyAuthOptional } from '../middleware/apiKeyAuth';
import { handleSignaling, endSessionPipeline, sessionPipelines } from '../services/signaling';
import { MSG91Transport } from '../services/transports/MSG91Transport';
import { canTransition } from '../services/transports/lifecycle';

const router = Router();
router.use(apiKeyAuthOptional);

const getTenantId = (req: Request) => (req as any).tenantId || DEFAULT_TENANT_ID;

// Fast lookup cache mapping call UUID to VOP Session ID
export const activeCallSessions = new Map<string, string>();

/**
 * Trigger an outbound call: POST /api/calls/outbound
 */
router.post('/outbound', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, phoneNumber } = req.body;

    // 1. Phone number format validation (E.164-like check: at least 7 digits, no invalid chars)
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ error: 'phoneNumber is required and must be a string.' });
      return;
    }
    const cleanDigits = phoneNumber.replace(/[+\s-]/g, '');
    if (!/^\d{7,15}$/.test(cleanDigits)) {
      res.status(400).json({ error: 'Invalid phone number format. Must contain between 7 and 15 digits.' });
      return;
    }

    // 2. Validate agent ID
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required and must be a string.' });
      return;
    }

    const latestVersion = await prisma.agentConfigVersion.findFirst({
      where: {
        agentConfigId: agentId,
        agentConfig: {
          project: {
            tenantId: getTenantId(req)
          }
        }
      },
      orderBy: { version: 'desc' },
      include: {
        agentConfig: true
      }
    });

    if (!latestVersion) {
      res.status(404).json({ error: 'Agent configuration not found.' });
      return;
    }

    // 3. Create postgres session record with status "initiating"
    const session = await prisma.session.create({
      data: {
        projectId: latestVersion.agentConfig.projectId,
        agentConfigVersionId: latestVersion.id,
        status: 'initiating',
        transport: 'msg91',
        phoneNumber
      }
    });

    console.log(`[Call Lifecycle] Session ${session.id} created with initial state: "initiating"`);

    // 4. Instantiate MSG91Transport and register in signaling map
    const transport = new MSG91Transport(session.id, phoneNumber);
    
    sessionPipelines.set(session.id, {
      transport,
      deepgramWs: null,
      ended: false,
      totalBytesSent: 0,
      chunksLog: [],
      responsesLog: [],
      interimTranscriptCount: 0
    });

    // 5. Dial out via MSG91 API
    try {
      await transport.connect();

      // Retrieve the generated call UUID (if any)
      const callUuid = transport.getCallUuid();
      
      if (callUuid) {
        activeCallSessions.set(callUuid, session.id);
        
        // Return successful outbound trigger metadata
        res.status(201).json({
          success: true,
          sessionId: session.id,
          callId: callUuid,
          transport: 'msg91',
          phoneNumber,
          status: 'initiating'
        });
      } else {
        // Did not return a call UUID: Dial failed or was in mockup mode
        throw new Error('No call UUID returned by MSG91 API gateway.');
      }

    } catch (dialError: any) {
      console.error(`[Call Lifecycle] Outbound dial failed for session ${session.id}:`, dialError);
      
      // Update session status to "failed"
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'failed', endedAt: new Date() }
      });

      await prisma.sessionEvent.create({
        data: {
          sessionId: session.id,
          eventType: 'provider_failure',
          metadata: {
            provider: 'msg91',
            message: dialError.message || 'Outbound call connection failed.',
            timestamp: new Date().toISOString()
          }
        }
      });

      // Clear signaling pipeline map
      sessionPipelines.delete(session.id);

      // Return friendly user error without exposing system variables
      res.status(502).json({
        error: 'Failed to initiate outbound call via MSG91.',
        reason: dialError.message || 'Provider connection failed.'
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * Handle status webhook events with idempotency and strict transition rules: POST /api/calls/webhook
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    console.log(`[Call Lifecycle Webhook] Received event:`, JSON.stringify(payload, null, 2));

    const { uuid, status: rawStatus, destination, failureReason } = payload;

    if (!uuid) {
      res.status(400).json({ error: 'uuid is required in callback payload.' });
      return;
    }

    // 1. Resolve Session ID
    let sessionId = activeCallSessions.get(uuid);

    if (!sessionId) {
      const event = await prisma.sessionEvent.findFirst({
        where: {
          eventType: 'msg91_call_initiated',
          metadata: {
            path: ['callId'],
            equals: uuid
          }
        }
      });
      if (event) {
        sessionId = event.sessionId;
        activeCallSessions.set(uuid, sessionId);
      }
    }

    if (!sessionId && destination) {
      const cleanPhone = destination.replace(/[+\s-]/g, '');
      const matched = await prisma.session.findFirst({
        where: {
          phoneNumber: { contains: cleanPhone },
          transport: 'msg91',
          // match active statuses
          status: { in: ['initiating', 'ringing', 'connected', 'in_progress'] }
        },
        orderBy: { startedAt: 'desc' }
      });
      if (matched) {
        sessionId = matched.id;
        activeCallSessions.set(uuid, sessionId);
      }
    }

    if (!sessionId) {
      console.warn(`[Call Lifecycle Webhook] Webhook ignored. Call UUID ${uuid} has no active database session.`);
      res.status(200).json({ success: true, message: 'Untracked call event. Webhook ignored.' });
      return;
    }

    // 2. Map MSG91 webhook status values to lifecycle states
    let targetState = 'initiating';
    
    switch (rawStatus) {
      case 'Ringing':
        targetState = 'ringing';
        break;
      case 'Answered':
        targetState = 'connected';
        break;
      case 'Completed':
      case 'Ended': {
        const pipeline = sessionPipelines.get(sessionId);
        if (pipeline && pipeline.transport && pipeline.transport.type === 'msg91') {
          const transport = pipeline.transport as MSG91Transport;
          targetState = transport.getDisconnectReason();
        } else {
          targetState = 'completed';
        }
        break;
      }
      case 'Failed':
        targetState = 'failed';
        break;
      case 'Busy':
        targetState = 'busy';
        break;
      case 'No Answer':
        targetState = 'no_answer';
        break;
      case 'Rejected':
        targetState = 'rejected';
        break;
      default:
        targetState = 'failed';
    }

    // 3. Load current session status
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // 4. Validate State Transition (idempotency & out-of-order check)
    if (!canTransition(session.status, targetState)) {
      console.warn(`[Call State Machine] Blocked out-of-order transition: "${session.status}" -> "${targetState}" for session ${sessionId}.`);
      res.status(200).json({ success: true, message: 'Out-of-order or duplicate webhook event ignored.' });
      return;
    }

    console.log(`[Call State Machine] Transition: "${session.status}" -> "${targetState}" for session ${sessionId}`);

    // 5. Perform Database Update
    const isTerminal = [
      'completed', 'no_answer', 'busy', 'rejected', 'callback_requested',
      'user_hangup', 'ai_hangup', 'unexpected_disconnect', 'failed', 'cancelled', 'timeout'
    ].includes(targetState);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: targetState,
        endedAt: isTerminal ? new Date() : undefined
      }
    });

    await prisma.sessionEvent.create({
      data: {
        sessionId,
        eventType: `call_state_${targetState}`,
        metadata: {
          callId: uuid,
          previousState: session.status,
          newState: targetState,
          failureReason: failureReason || null,
          timestamp: new Date().toISOString()
        }
      }
    });

    // 6. Manage turn signaling loops
    if (targetState === 'connected') {
      const pipeline = sessionPipelines.get(sessionId);
      if (pipeline && !pipeline.deepgramWs) {
        console.log(`[Call State Machine] Call answered. Launching STT Voice loops for session ${sessionId}`);
        // Synchronize signaling websocket start
        handleSignaling(null as any, sessionId);
      }
    }

    // 7. Cleanup resources on terminal transition
    if (isTerminal) {
      activeCallSessions.delete(uuid);
      await endSessionPipeline(sessionId);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    next(error);
  }
});

export default router;
