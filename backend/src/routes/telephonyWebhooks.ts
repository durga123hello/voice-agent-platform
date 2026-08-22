import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { updateSessionState, CallState } from '../services/transports/lifecycle';

const router = Router();

// Plivo Call Status Webhook: POST /api/telephony/plivo/status/:sessionId
router.post('/plivo/status/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const payload = req.body;

    console.log(`[Plivo Webhook] Received call status update for session ${sessionId}:`, JSON.stringify(payload, null, 2));

    const { CallStatus, HangupCause, CallUUID } = payload;

    // 1. Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.warn(`[Plivo Webhook] Ignored. Session not found: ${sessionId}`);
      res.status(200).json({ success: true, message: 'Session not found. Ignored.' });
      return;
    }

    // CallUUID Mismatch Check
    if (session.providerCallId && CallUUID && session.providerCallId !== CallUUID) {
      console.warn(`[Plivo Webhook Mismatch] Incoming CallUUID ${CallUUID} does not match stored providerCallId ${session.providerCallId} for session ${sessionId}. Ignoring.`);
      res.status(200).json({ success: true, message: 'CallUUID mismatch. Ignored.' });
      return;
    }

    // 2. Map Plivo status and HangupCause to VOP lowercase states and error codes
    let callState: CallState | null = null;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let endedReason: string | undefined;

    const statusUpper = (CallStatus || '').toLowerCase();
    const causeUpper = (HangupCause || '').toUpperCase();
    const hangupSource = (payload.HangupSource || payload.hangup_source || '').toLowerCase();

    if (statusUpper === 'ringing') {
      callState = 'ringing';
    } else if (statusUpper === 'in-progress') {
      callState = 'connected';
    } else if (statusUpper === 'busy' || causeUpper === 'USER_BUSY') {
      callState = 'busy';
      errorCode = 'CALL_BUSY';
      errorMessage = 'Recipient line was busy.';
    } else if (statusUpper === 'no-answer' || causeUpper === 'NO_ANSWER' || causeUpper === 'NO_USER_RESPONSE') {
      callState = 'no_answer';
      errorCode = 'CALL_NO_ANSWER';
      errorMessage = 'Recipient did not answer.';
    } else if (statusUpper === 'rejected' || causeUpper === 'CALL_REJECTED') {
      callState = 'rejected';
      errorCode = 'CALL_REJECTED';
      errorMessage = 'Recipient declined the call.';
    } else if (causeUpper === 'ORIGINATOR_CANCEL') {
      callState = 'cancelled';
      errorCode = 'CALL_CANCELLED';
      errorMessage = 'Caller cancelled the call before answer.';
    } else if (causeUpper === 'TIMEOUT') {
      callState = 'timeout';
      errorCode = 'CALL_TIMEOUT';
      errorMessage = 'Ringing timed out without answer.';
    } else if (statusUpper === 'failed') {
      callState = 'failed';
      errorCode = 'CALL_PROVIDER_ERROR';
      errorMessage = `Plivo reported call failure. Cause: ${HangupCause || 'Unknown'}`;
    } else if (statusUpper === 'completed') {
      if (hangupSource === 'callee') {
        callState = 'user_hangup';
        endedReason = 'user_hangup';
        errorMessage = 'The recipient ended the call.';
      } else if (['caller', 'api request', 'answer xml'].includes(hangupSource)) {
        callState = 'ai_hangup';
        endedReason = 'ai_hangup';
        errorMessage = 'Call completed successfully.';
      } else {
        callState = 'unexpected_disconnect';
        errorCode = 'CALL_UNEXPECTED_DISCONNECT';
        errorMessage = 'The call was disconnected unexpectedly.';
      }
    }

    // 3. Update session status if we resolved a valid call state
    if (callState) {
      await updateSessionState(sessionId, {
        providerCallId: CallUUID || undefined,
        callState,
        errorCode,
        errorMessage,
        endedReason
      });

      const isFinalState = [
        'busy',
        'no_answer',
        'rejected',
        'cancelled',
        'timeout',
        'failed',
        'user_hangup',
        'ai_hangup',
        'unexpected_disconnect'
      ].includes(callState);

      if (isFinalState) {
        try {
          const { closeTelephonySession } = require('../services/telephony/orchestrator');
          closeTelephonySession(sessionId);
          console.log(`[Plivo Webhook] Telephony session ${sessionId} successfully cleaned up (final state: ${callState})`);
        } catch (err) {
          console.error(`[Plivo Webhook Cleanup Error] Failed to close telephony session:`, err);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Plivo Webhook Error] Failed processing status update:`, error);
    next(error);
  }
});

// Plivo Call Recording Webhook: POST /api/telephony/plivo/recordings/:sessionId
router.post('/plivo/recordings/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const payload = req.body;

    console.log(`[Plivo Recording Webhook] Received recording callback for session ${sessionId}:`, JSON.stringify(payload, null, 2));

    const { RecordUrl, RecordingID, RecordingDuration } = payload;

    if (RecordUrl) {
      // Save the recording URL directly to the Session model
      await prisma.session.update({
        where: { id: sessionId },
        data: { recordingUrl: RecordUrl }
      });
      console.log(`[Plivo Recording Webhook] Recording saved directly to Session ${sessionId}: ${RecordUrl}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Plivo Recording Webhook Error] Failed processing recording callback:`, error);
    next(error);
  }
});

export default router;
