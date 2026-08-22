import WebSocket from 'ws';
import prisma from '../../db/client';

// Configurable Timeout Values
export const SESSION_IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MS) || 600000;
export const MEDIA_RECONNECT_GRACE_MS = Number(process.env.MEDIA_RECONNECT_GRACE_MS) || 15000;
export const ANSWER_MEDIA_TIMEOUT_MS = Number(process.env.ANSWER_MEDIA_TIMEOUT_MS) || 10000;
export const PLIVO_API_MAX_RETRIES = Number(process.env.PLIVO_API_MAX_RETRIES) || 3;
export const MEDIA_NO_AUDIO_TIMEOUT_MS = Number(process.env.MEDIA_NO_AUDIO_TIMEOUT_MS) || 15000;

// ----------------------------------------------------
// Multi-Dimensional State Type Definitions (Lowercase)
// ----------------------------------------------------

export type CallState =
  | 'initiating'
  | 'ringing'
  | 'connected'
  | 'in_progress'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'rejected'
  | 'callback_requested'
  | 'user_hangup'
  | 'ai_hangup'
  | 'unexpected_disconnect'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'active'
  | 'aborted';

export type MediaState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'interrupted'
  | 'reconnecting'
  | 'failed'
  | 'closed';

export type ConversationState =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'completed'
  | 'interrupted'
  | 'callback_requested'
  | 'transfer_requested'
  | 'cancelled';

// ----------------------------------------------------
// Transition Matrix Configurations
// ----------------------------------------------------

const VALID_CALL_TRANSITIONS: Record<CallState, CallState[]> = {
  initiating: ['ringing', 'connected', 'in_progress', 'failed', 'cancelled', 'timeout', 'aborted'],
  ringing: ['connected', 'in_progress', 'no_answer', 'busy', 'rejected', 'failed', 'cancelled', 'timeout', 'aborted'],
  connected: ['in_progress', 'completed', 'user_hangup', 'ai_hangup', 'unexpected_disconnect', 'callback_requested', 'timeout', 'failed', 'aborted'],
  in_progress: ['completed', 'user_hangup', 'ai_hangup', 'unexpected_disconnect', 'callback_requested', 'timeout', 'failed', 'aborted'],
  
  // Terminal states (cannot transition anywhere else)
  completed: [],
  no_answer: [],
  busy: [],
  rejected: [],
  callback_requested: [],
  user_hangup: [],
  ai_hangup: [],
  unexpected_disconnect: [],
  failed: [],
  cancelled: [],
  timeout: [],
  active: ['completed', 'aborted', 'initiating', 'ringing', 'connected', 'in_progress', 'no_answer', 'busy', 'rejected', 'callback_requested', 'user_hangup', 'ai_hangup', 'unexpected_disconnect', 'failed', 'cancelled', 'timeout'],
  aborted: []
};

const VALID_MEDIA_TRANSITIONS: Record<MediaState, MediaState[]> = {
  disconnected: ['connecting', 'connected', 'failed', 'closed'],
  connecting: ['connected', 'failed', 'closed'],
  connected: ['streaming', 'interrupted', 'reconnecting', 'failed', 'closed'],
  streaming: ['interrupted', 'reconnecting', 'failed', 'closed'],
  interrupted: ['streaming', 'connected', 'reconnecting', 'failed', 'closed'],
  reconnecting: ['connected', 'failed', 'closed'],
  failed: [],
  closed: []
};

const VALID_CONVERSATION_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  idle: ['greeting', 'listening', 'cancelled'],
  greeting: ['listening', 'interrupted', 'cancelled'],
  listening: ['processing', 'completed', 'callback_requested', 'transfer_requested', 'cancelled'],
  processing: ['responding', 'interrupted', 'idle', 'cancelled'],
  responding: ['listening', 'interrupted', 'completed', 'callback_requested', 'transfer_requested', 'cancelled'],
  completed: [],
  interrupted: [],
  callback_requested: [],
  transfer_requested: [],
  cancelled: []
};

/**
 * Validates whether a state transition from currentState to newState is allowed.
 * Prevents moving call state backward, ensuring webhook idempotency and protecting
 * against out-of-order webhook delivery.
 */
export function canTransition(currentState: string, newState: string): boolean {
  const current = currentState as CallState;
  const target = newState as CallState;
  if (current === target) return true;
  const allowed = VALID_CALL_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function canTransitionMedia(current: MediaState, target: MediaState): boolean {
  if (current === target) return true;
  const allowed = VALID_MEDIA_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function canTransitionConversation(current: ConversationState, target: ConversationState): boolean {
  if (current === target) return true;
  const allowed = VALID_CONVERSATION_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

// ----------------------------------------------------
// UI friendly messages mapping
// ----------------------------------------------------
export function mapErrorCodeToUserMessage(code: string, defaultMsg?: string): string {
  switch (code) {
    case 'CALL_INVALID_NUMBER':
      return 'Call could not be started: Invalid phone number.';
    case 'CALL_PROVIDER_ERROR':
      return 'Call failed: Telephony provider rejected the request.';
    case 'CALL_BUSY':
      return "The recipient's line is busy.";
    case 'CALL_NO_ANSWER':
      return "The recipient did not answer the call.";
    case 'CALL_REJECTED':
      return "The recipient rejected the call.";
    case 'CALL_TIMEOUT':
      return "The call timed out.";
    case 'CALL_CANCELLED':
      return "The call was cancelled.";
    case 'CALL_CREATION_FAILED':
      return 'Call failed: Could not trigger outbound call on provider side.';
    case 'CALL_UNEXPECTED_DISCONNECT':
      return "The call was disconnected unexpectedly.";
    case 'CALL_DISCONNECTED':
      return 'Disconnected: The call connection was lost.';
    case 'MEDIA_CONNECTION_FAILED':
      return 'Media error: Could not establish audio stream.';
    case 'MEDIA_NO_AUDIO':
      return 'The call connected, but no audio was received.';
    case 'STT_ERROR':
      return 'Speech recognition stopped working.';
    case 'LLM_ERROR':
      return 'The AI was unable to generate a response.';
    case 'TTS_ERROR':
      return 'The AI voice could not generate audio.';
    default:
      return defaultMsg || 'An unexpected error occurred during the call.';
  }
}

// ----------------------------------------------------
// UI Real-time WebSocket Broadcast Registry
// ----------------------------------------------------
export const uiClients = new Map<string, WebSocket[]>();

export function registerUiWebSocket(sessionId: string, ws: WebSocket) {
  const list = uiClients.get(sessionId) || [];
  list.push(ws);
  uiClients.set(sessionId, list);

  ws.on('close', () => {
    const active = uiClients.get(sessionId) || [];
    const filtered = active.filter(c => c !== ws);
    if (filtered.length > 0) {
      uiClients.set(sessionId, filtered);
    } else {
      uiClients.delete(sessionId);
    }
  });
}

export function broadcastSessionState(sessionId: string, data: any) {
  const clients = uiClients.get(sessionId);
  if (!clients) return;

  const payload = JSON.stringify({ sessionId, ...data });
  console.log(`[WS Broadcast] Sending state update to ${clients.length} UI client(s) for session ${sessionId}:`, payload);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// ----------------------------------------------------
// Central Postgres State Updater (Single Source of Truth)
// ----------------------------------------------------
export async function updateSessionState(
  sessionId: string,
  update: {
    providerCallId?: string;
    callState?: CallState;
    mediaState?: MediaState;
    conversationState?: ConversationState;
    endedReason?: string;
    errorCode?: string;
    errorMessage?: string;
    userMessage?: string;
  }
) {
  try {
    const existing = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!existing) {
      console.warn(`[State Updater] Session not found for ID: ${sessionId}`);
      return null;
    }

    const currentCallState = existing.callState as CallState;
    const terminalStates: CallState[] = ['completed', 'no_answer', 'busy', 'rejected', 'callback_requested', 'user_hangup', 'ai_hangup', 'unexpected_disconnect', 'failed', 'cancelled', 'timeout', 'aborted'];

    // Validate transitions
    const finalUpdate: any = {};

    if (update.providerCallId !== undefined) {
      finalUpdate.providerCallId = update.providerCallId;
    }

    if (update.callState) {
      // Locking check: if currently in terminal state, do not allow changing callState
      const isOverride = 
        ['failed', 'unexpected_disconnect'].includes(currentCallState) && 
        ['user_hangup', 'ai_hangup', 'completed'].includes(update.callState);

      if (terminalStates.includes(currentCallState) && !isOverride) {
        console.log(`[State Updater] Lock engaged. Session ${sessionId} is already in terminal state "${existing.callState}". Rejecting transition to "${update.callState}".`);
      } else if (isOverride || canTransition(existing.callState, update.callState)) {
        finalUpdate.callState = update.callState;
      } else {
        console.warn(`[State Updater] Invalid call transition: ${existing.callState} -> ${update.callState}. Blocked.`);
      }
    }

    if (update.mediaState) {
      if (canTransitionMedia(existing.mediaState as MediaState, update.mediaState)) {
        finalUpdate.mediaState = update.mediaState;
      } else {
        console.warn(`[State Updater] Invalid media transition: ${existing.mediaState} -> ${update.mediaState}. Blocked.`);
      }
    }

    if (update.conversationState) {
      if (canTransitionConversation(existing.conversationState as ConversationState, update.conversationState)) {
        finalUpdate.conversationState = update.conversationState;
      } else {
        console.warn(`[State Updater] Invalid conversation transition: ${existing.conversationState} -> ${update.conversationState}. Blocked.`);
      }
    }

    if (update.endedReason !== undefined) {
      finalUpdate.endedReason = update.endedReason;
    }

    if (update.errorCode !== undefined) {
      finalUpdate.errorCode = update.errorCode;
      finalUpdate.userMessage = mapErrorCodeToUserMessage(update.errorCode, update.errorMessage);
    }

    if (update.errorMessage !== undefined) {
      finalUpdate.errorMessage = update.errorMessage;
    }

    if (update.userMessage !== undefined) {
      finalUpdate.userMessage = update.userMessage;
    }

    // Preserve Database Status Semantics:
    // completed/user_hangup/ai_hangup -> completed
    // failed/busy/no_answer/rejected/cancelled/timeout/aborted/unexpected_disconnect -> aborted
    const targetCallState = finalUpdate.callState || existing.callState;
    if (terminalStates.includes(targetCallState)) {
      finalUpdate.endedAt = new Date();
      if (['completed', 'user_hangup', 'ai_hangup'].includes(targetCallState)) {
        finalUpdate.status = 'completed';
      } else {
        finalUpdate.status = 'aborted';
      }

      // Default user message mapping for clean hangups
      if (targetCallState === 'user_hangup' && !finalUpdate.userMessage && !existing.userMessage) {
        finalUpdate.userMessage = 'The call was ended by the recipient.';
      } else if (targetCallState === 'ai_hangup' && !finalUpdate.userMessage && !existing.userMessage) {
        finalUpdate.userMessage = 'Call completed successfully.';
      }
    }

    if (Object.keys(finalUpdate).length === 0) {
      return existing;
    }

    console.log(`[State Updater] Committing state updates for session ${sessionId}:`, finalUpdate);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: finalUpdate
    });

    // Broadcast real-time status to connected frontends
    broadcastSessionState(sessionId, {
      providerCallId: updated.providerCallId,
      callState: updated.callState,
      mediaState: updated.mediaState,
      conversationState: updated.conversationState,
      status: updated.status,
      errorCode: updated.errorCode,
      errorMessage: updated.errorMessage,
      userMessage: updated.userMessage
    });

    return updated;
  } catch (err) {
    console.error(`[State Updater Error] Failed to update session ${sessionId}:`, err);
    throw err;
  }
}

// ----------------------------------------------------
// Zombie Session Protection Reaper
// ----------------------------------------------------
export async function reapZombiesOnStartup() {
  try {
    console.log('[Zombie Reaper] Performing startup sweep for leaked active sessions...');
    const leakedSessions = await prisma.session.findMany({
      where: {
        status: 'active'
      }
    });

    if (leakedSessions.length > 0) {
      console.log(`[Zombie Reaper] Found ${leakedSessions.length} leaked active sessions on startup. Marking as aborted.`);
      for (const session of leakedSessions) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            status: 'aborted',
            callState: 'failed',
            mediaState: 'failed',
            endedReason: 'Server reboot cleanup',
            errorCode: 'CALL_DISCONNECTED',
            errorMessage: 'Session was closed due to a server restart.',
            endedAt: new Date()
          }
        });
      }
      console.log(`[Zombie Reaper] Successfully cleaned up ${leakedSessions.length} leaked sessions.`);
    }
  } catch (err) {
    console.error('[Zombie Reaper Error] Startup sweep failed:', err);
  }
}

export async function startZombieReaper() {
  console.log(`[Zombie Reaper] Starting background zombie session reaper (Threshold: ${SESSION_IDLE_TIMEOUT_MS}ms)...`);
  
  // Perform immediate startup sweep
  reapZombiesOnStartup().catch(err => console.error('[Zombie Reaper Startup Error]', err));

  setInterval(async () => {
    try {
      const timeoutThreshold = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS);
      // Query active sessions that have not had any updates since the threshold
      const activeSessions = await prisma.session.findMany({
        where: {
          callState: {
            in: ['initiating', 'ringing', 'connected', 'in_progress']
          },
          lastActivityAt: {
            lt: timeoutThreshold
          }
        }
      });

      if (activeSessions.length > 0) {
        console.log(`[Zombie Reaper] Found ${activeSessions.length} inactive active sessions to reap.`);
        const { endSessionPipeline } = require('../signaling');
        for (const session of activeSessions) {
          console.log(`[Zombie Reaper] Reaping inactive session: ${session.id} (lastActivityAt: ${session.lastActivityAt.toISOString()})`);
          await updateSessionState(session.id, {
            callState: 'failed',
            mediaState: 'closed',
            errorCode: 'CALL_TIMEOUT',
            errorMessage: 'Call timed out due to inactivity.',
            endedReason: 'Session timed out due to inactivity.'
          });
          try {
            await endSessionPipeline(session.id);
          } catch (cleanErr) {
            console.error(`[Zombie Reaper Error] Cleanup failed for session ${session.id}:`, cleanErr);
          }
        }
      }
    } catch (err) {
      console.error('[Zombie Reaper Error] Background reaper query failed:', err);
    }
  }, 60000);
}
