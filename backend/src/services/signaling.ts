import WebSocket from 'ws';
import { getRouter } from './mediasoup';
import { findFreeUdpPort } from '../utils/ports';
import prisma from '../db/client';
import { DEFAULT_USER_ID } from '../index';
import redis from '../db/redis';
import { decrypt } from '../utils/crypto';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import ffmpegPath from 'ffmpeg-static';

const transports = new Map<string, any>();
const producers = new Map<string, any>();

interface SessionPipeline {
  clientWs: WebSocket | null;
  deepgramWs: WebSocket | null;
  ffmpegProcess: any;
  consumer: any;
  plainTransport: any;
  sdpPath: string;
  mediasoupTransports: Set<string>;
  mediasoupProducers: Set<string>;
  ended: boolean;
  totalBytesSent?: number;
  chunksLog?: { streamTime: number; sentTime: number }[];
  responsesLog?: { responseEndTime: number; recvTime: number }[];
  interimTranscriptCount?: number;
  firstResponseTime?: number;
  sentStopVal?: number;
  lastSttDurationMs?: number;
}

export const sessionPipelines = new Map<string, SessionPipeline>();

const activeSessions = new Map<string, {
  abortController: AbortController | null;
  ttsWorker: TtsQueueWorker | null;
}>();

const activeTurnLatencies = new Map<string, {
  turnStartTime: number;
  firstTokenTime?: number;
  firstAudioTime?: number;
  llmStartTime?: number;
  llmDurationMs?: number;
  ttsChunkDurations?: number[];
  ttsNetworkDurations?: number[];
  ttsRelayDurations?: number[];
}>();

// Silence/pause detection variables
const silenceTimers = new Map<string, NodeJS.Timeout>();
const SILENCE_TIMEOUT_MS = 15000; // 15 seconds
const MAX_NUDGES = 3;

const REDIS_TTL = 14400; // 4 hours in seconds

export async function getSessionState(sessionId: string): Promise<'listening' | 'thinking' | 'speaking'> {
  const start = Date.now();
  const val = await redis.get(`session:${sessionId}:state`);
  console.log(`[Redis Timing] getSessionState took ${Date.now() - start}ms`);
  return (val as 'listening' | 'thinking' | 'speaking') || 'listening';
}

export async function setSessionState(sessionId: string, state: 'listening' | 'thinking' | 'speaking') {
  const start = Date.now();
  await redis.setex(`session:${sessionId}:state`, REDIS_TTL, state);
  console.log(`[Redis Timing] setSessionState took ${Date.now() - start}ms`);
}

export async function deleteSessionState(sessionId: string) {
  const start = Date.now();
  await redis.del(`session:${sessionId}:state`);
  console.log(`[Redis Timing] deleteSessionState took ${Date.now() - start}ms`);
}

export async function getNudgeCount(sessionId: string): Promise<number> {
  const start = Date.now();
  const val = await redis.get(`session:${sessionId}:nudge_count`);
  console.log(`[Redis Timing] getNudgeCount took ${Date.now() - start}ms`);
  return val ? parseInt(val, 10) : 0;
}

export async function setNudgeCount(sessionId: string, count: number) {
  const start = Date.now();
  await redis.setex(`session:${sessionId}:nudge_count`, REDIS_TTL, count.toString());
  console.log(`[Redis Timing] setNudgeCount took ${Date.now() - start}ms`);
}

export async function incrementNudgeCount(sessionId: string): Promise<number> {
  const start = Date.now();
  const newCount = await redis.incr(`session:${sessionId}:nudge_count`);
  await redis.expire(`session:${sessionId}:nudge_count`, REDIS_TTL);
  console.log(`[Redis Timing] incrementNudgeCount took ${Date.now() - start}ms`);
  return newCount;
}

export async function deleteNudgeCount(sessionId: string) {
  const start = Date.now();
  await redis.del(`session:${sessionId}:nudge_count`);
  console.log(`[Redis Timing] deleteNudgeCount took ${Date.now() - start}ms`);
}

export async function getSessionSpeech(sessionId: string): Promise<string> {
  const start = Date.now();
  const val = await redis.get(`session:${sessionId}:speech`);
  console.log(`[Redis Timing] getSessionSpeech took ${Date.now() - start}ms`);
  return val || '';
}

export async function setSessionSpeech(sessionId: string, speech: string) {
  const start = Date.now();
  await redis.setex(`session:${sessionId}:speech`, REDIS_TTL, speech);
  console.log(`[Redis Timing] setSessionSpeech took ${Date.now() - start}ms`);
}

export async function deleteSessionSpeech(sessionId: string) {
  const start = Date.now();
  await redis.del(`session:${sessionId}:speech`);
  console.log(`[Redis Timing] deleteSessionSpeech took ${Date.now() - start}ms`);
}

// Conversation history cache helpers
export async function getSessionHistory(sessionId: string): Promise<any[]> {
  const start = Date.now();
  const val = await redis.get(`session:${sessionId}:history`);
  if (val) {
    try {
      console.log(`[Redis Timing] getSessionHistory (cache hit) took ${Date.now() - start}ms`);
      return JSON.parse(val);
    } catch (e) {
      console.error('[Redis History Parse Error]', e);
    }
  }
  // Fallback to PostgreSQL
  const dbMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' }
  });
  const history = dbMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
  // Cache in Redis
  await redis.setex(`session:${sessionId}:history`, REDIS_TTL, JSON.stringify(history));
  console.log(`[Redis Timing] getSessionHistory (cache miss + load + cache write) took ${Date.now() - start}ms`);
  return history;
}

export async function setSessionHistory(sessionId: string, history: any[]) {
  const start = Date.now();
  await redis.setex(`session:${sessionId}:history`, REDIS_TTL, JSON.stringify(history));
  console.log(`[Redis Timing] setSessionHistory took ${Date.now() - start}ms`);
}

export async function appendSessionHistory(sessionId: string, message: { role: string; content: string }) {
  const start = Date.now();
  const current = await getSessionHistory(sessionId);
  current.push(message);
  await setSessionHistory(sessionId, current);
  console.log(`[Redis Timing] appendSessionHistory total took ${Date.now() - start}ms`);
}

export async function deleteSessionHistory(sessionId: string) {
  const start = Date.now();
  await redis.del(`session:${sessionId}:history`);
  console.log(`[Redis Timing] deleteSessionHistory took ${Date.now() - start}ms`);
}

export async function clearAllRedisSessionKeys(sessionId: string) {
  const start = Date.now();
  console.log(`[Redis Cleanup] Clearing ephemeral keys for session ${sessionId}`);
  await redis.del(
    `session:${sessionId}:state`,
    `session:${sessionId}:nudge_count`,
    `session:${sessionId}:speech`,
    `session:${sessionId}:history`
  );
  console.log(`[Redis Timing] clearAllRedisSessionKeys took ${Date.now() - start}ms`);
}

export function isTrivialUtterance(text: string): boolean {
  const cleaned = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
  if (!cleaned) return true;
  
  // Check for common filler words (um, uh, ah, oh, er, huh, mhm)
  const fillerWords = new Set(['um', 'uh', 'ah', 'oh', 'er', 'huh', 'mhm', 'uhhuh', 'mhm']);
  const words = cleaned.split(/\s+/);
  
  // If all words in the utterance are filler, it is trivial
  const allFiller = words.every(w => fillerWords.has(w));
  if (allFiller) return true;

  // If it's a single word and very short (length <= 2, or just filler/punctuation)
  if (words.length === 1 && cleaned.length <= 2) {
    return true;
  }

  return false;
}

export async function endSessionPipeline(sessionId: string, closingWs?: WebSocket) {
  const pipeline = sessionPipelines.get(sessionId);
  if (!pipeline) return;

  // Reconnect guard: If a closingWs is specified, only clean up if it matches the current registry socket
  if (closingWs && pipeline.clientWs !== closingWs) {
    console.log(`[endSessionPipeline] Ignoring close event from stale WebSocket for session ${sessionId}`);
    return;
  }

  // Prevent multiple cleanups
  pipeline.ended = true;
  sessionPipelines.delete(sessionId);

  console.log(`[endSessionPipeline] Force terminating session pipeline for ${sessionId}`);

  // 1. Clear timers, cancel LLM/TTS active turn, and clear Redis ephemeral keys
  clearSilenceTimer(sessionId);
  cancelActiveTurn(sessionId);
  await clearAllRedisSessionKeys(sessionId);

  // 2. Fetch the session and log auto-abort if currently active
  try {
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { role: 'assistant' }
        }
      }
    });

    if (dbSession && dbSession.status === 'active') {
      const elapsed = Date.now() - (dbSession.startedAt ? dbSession.startedAt.getTime() : Date.now());
      const turnsCount = dbSession.messages.length;

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'aborted',
          endedAt: new Date()
        }
      });

      await prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'abort',
          metadata: {
            abortedAtTurn: turnsCount,
            elapsedTimeMs: elapsed
          }
        }
      });
      console.log(`[endSessionPipeline] Auto-aborted active session ${sessionId} at turn ${turnsCount} after ${elapsed}ms.`);
    }
  } catch (err) {
    console.error('[endSessionPipeline] Database update error:', err);
  }

  // 2. Close client WS
  if (pipeline.clientWs && pipeline.clientWs.readyState === WebSocket.OPEN) {
    try {
      pipeline.clientWs.send(JSON.stringify({ type: 'sessionEnded' }));
      pipeline.clientWs.close();
    } catch (e) {}
  }

  // 3. Close Deepgram WS
  if (pipeline.deepgramWs && pipeline.deepgramWs.readyState === WebSocket.OPEN) {
    try {
      pipeline.deepgramWs.close();
    } catch (e) {}
  }

  // 4. Kill FFmpeg process
  if (pipeline.ffmpegProcess) {
    try {
      pipeline.ffmpegProcess.kill('SIGKILL');
    } catch (e) {}
  }

  // 5. Close consumer & plainTransport
  if (pipeline.consumer) {
    try {
      pipeline.consumer.close();
    } catch (e) {}
  }
  if (pipeline.plainTransport) {
    try {
      pipeline.plainTransport.close();
    } catch (e) {}
  }

  // 6. Delete SDP file
  if (pipeline.sdpPath) {
    try {
      if (fs.existsSync(pipeline.sdpPath)) {
        fs.unlinkSync(pipeline.sdpPath);
      }
    } catch (e) {}
  }

  // 7. Close Mediasoup Producers
  for (const producerId of pipeline.mediasoupProducers) {
    const producer = producers.get(producerId);
    if (producer) {
      try {
        producer.close();
      } catch (e) {}
      producers.delete(producerId);
    }
  }

  // 8. Close Mediasoup Transports
  for (const transportId of pipeline.mediasoupTransports) {
    const transport = transports.get(transportId);
    if (transport) {
      try {
        transport.close();
      } catch (e) {}
      transports.delete(transportId);
    }
  }
}

function clearSilenceTimer(sessionId: string) {
  const timer = silenceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    silenceTimers.delete(sessionId);
  }
  deleteNudgeCount(sessionId).catch(err => console.error('[Redis Error] Failed to clear nudge count:', err));
}

function stopSilenceTimer(sessionId: string) {
  const timer = silenceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    silenceTimers.delete(sessionId);
  }
}

async function resetSilenceTimer(sessionId: string, clientWs: WebSocket) {
  if (!sessionPipelines.has(sessionId)) {
    return;
  }
  const existingTimer = silenceTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  if (clientWs.readyState !== WebSocket.OPEN) {
    return;
  }

  // State machine check: only count down/reset if the state machine is actually in 'listening' state!
  const currentState = await getSessionState(sessionId);
  if (currentState !== 'listening') {
    console.log(`[Silence Handler] State is ${currentState}, suspending/clearing silence timer for session ${sessionId}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
      silenceTimers.delete(sessionId);
    }
    return;
  }

  const timer = setTimeout(async () => {
    try {
      if (!sessionPipelines.has(sessionId)) {
        return;
      }
      // Re-verify state is still 'listening' (guard against races)
      const state = await getSessionState(sessionId);
      if (state !== 'listening') {
        console.log(`[Silence Handler] State changed to ${state} during timeout, ignoring nudge trigger.`);
        return;
      }
      if (activeSessions.has(sessionId)) {
        // If the assistant is currently speaking or generating, check again in 15s
        await resetSilenceTimer(sessionId, clientWs);
        return;
      }

      const nudgeCount = await getNudgeCount(sessionId);
      if (nudgeCount >= MAX_NUDGES) {
        console.log(`[Silence Handler] Max nudges (${MAX_NUDGES}) reached for session ${sessionId}. Stopping nudges.`);
        return;
      }

      console.log(`[Silence Handler] Silence detected for 15s in session ${sessionId}. Triggering nudge ${nudgeCount + 1}...`);
      
      // Log session event
      await prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'silence_prompt',
          metadata: { nudgeIndex: nudgeCount + 1 }
        }
      });

      // Increment nudge count
      await incrementNudgeCount(sessionId);

      // Trigger synthetic LLM turn
      await triggerLlmTurn(sessionId, clientWs, true);

      // Reset the timer for the next check
      await resetSilenceTimer(sessionId, clientWs);
    } catch (err) {
      console.error('[Silence Handler Error]', err);
    }
  }, SILENCE_TIMEOUT_MS);

  silenceTimers.set(sessionId, timer);
}

export function handleSignaling(ws: WebSocket, sessionId: string) {
  console.log(`[WebSocket Open] Session ID: ${sessionId}`);

  // Reconnect check
  const isReconnect = sessionPipelines.has(sessionId);
  if (isReconnect) {
    console.log(`[Signaling] Reconnection detected for session ${sessionId}. Logging event.`);
    prisma.sessionEvent.create({
      data: {
        sessionId,
        eventType: 'reconnect',
        metadata: { timestamp: new Date().toISOString() }
      }
    }).catch(err => console.error('[Database Log Error] Failed to log reconnect event:', err));
  }

  // Initialize pipeline synchronously first, so we don't yield the event loop before listeners are bound!
  sessionPipelines.set(sessionId, {
    clientWs: ws,
    deepgramWs: null,
    ffmpegProcess: null,
    consumer: null,
    plainTransport: null,
    sdpPath: '',
    mediasoupTransports: new Set<string>(),
    mediasoupProducers: new Set<string>(),
    ended: false,
    totalBytesSent: 0,
    chunksLog: [],
    responsesLog: [],
    interimTranscriptCount: 0
  });

  // Reconnect cleanup safety: Cancel active turn (synchronous)
  cancelActiveTurn(sessionId);

  // Trigger async Redis cleanup in background without awaiting, so execution stays synchronous
  Promise.all([
    setSessionState(sessionId, 'listening'),
    deleteSessionSpeech(sessionId),
    deleteNudgeCount(sessionId)
  ]).then(() => {
    console.log(`[Signaling Init] Ephemeral session keys for ${sessionId} initialized in Redis.`);
  }).catch(err => {
    console.error('[Signaling Init Error] Failed to initialize Redis state:', err);
  });

  // Synchronously reset timer references
  clearSilenceTimer(sessionId);

  ws.on('message', async (message: string) => {
    if (!sessionPipelines.has(sessionId)) {
      console.log(`[Signaling] WebSocket message received after session ended. Ignoring.`);
      return;
    }
    try {
      const data = JSON.parse(message);
      console.log(`[WebSocket Message Received] Session: ${sessionId}, type: ${data.type}`);
      const router = getRouter();

      switch (data.type) {
        case 'getRouterRtpCapabilities': {
          console.log(`[Signaling] Sending Router RTP capabilities to client for session ${sessionId}`);
          ws.send(JSON.stringify({
            type: 'routerRtpCapabilities',
            rtpCapabilities: router.rtpCapabilities
          }));
          break;
        }

        case 'createWebRtcTransport': {
          console.log(`[Signaling] Requesting server-side WebRtcTransport creation...`);
          const transport = await router.createWebRtcTransport({
            listenIps: [
              { ip: '127.0.0.1', announcedIp: '127.0.0.1' }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true
          });

          console.log(`[mediasoup] WebRtcTransport created successfully. ID: ${transport.id}`);
          transports.set(transport.id, transport);

          const pipeline = sessionPipelines.get(sessionId);
          if (pipeline) {
            pipeline.mediasoupTransports.add(transport.id);
          }

          // Listen for server-side ICE and DTLS state changes
          transport.on('icestatechange', (iceState) => {
            console.log(`[Server WebRtcTransport ICE State Change] ID: ${transport.id}, state: ${iceState}`);
          });

          transport.on('dtlsstatechange', (dtlsState) => {
            console.log(`[Server WebRtcTransport DTLS State Change] ID: ${transport.id}, state: ${dtlsState}`);
            if (dtlsState === 'failed' || dtlsState === 'closed') {
              console.error(`[Server WebRtcTransport DTLS Failure] DTLS state is now ${dtlsState}`);
            }
          });

          transport.on('iceselectedtuplechange', (iceSelectedTuple) => {
            console.log(`[Server WebRtcTransport ICE Selected Tuple Change] ID: ${transport.id}, tuple:`, JSON.stringify(iceSelectedTuple));
          });

          ws.send(JSON.stringify({
            type: 'webRtcTransportCreated',
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }));
          break;
        }

        case 'connectWebRtcTransport': {
          const { transportId, dtlsParameters } = data;
          console.log(`[Signaling] Connecting server-side WebRtcTransport ${transportId} with DTLS parameters...`);
          const transport = transports.get(transportId);
          if (!transport) {
            throw new Error(`Transport with id ${transportId} not found`);
          }

          await transport.connect({ dtlsParameters });
          console.log(`[mediasoup] WebRtcTransport ${transportId} connected successfully.`);
          ws.send(JSON.stringify({ type: 'webRtcTransportConnected' }));
          break;
        }

        case 'produce': {
          const { transportId, kind, rtpParameters } = data;
          console.log(`[Signaling] Requesting production on WebRtcTransport ${transportId}, kind: ${kind}`);
          const transport = transports.get(transportId);
          if (!transport) {
            throw new Error(`Transport with id ${transportId} not found`);
          }

          const producer = await transport.produce({ kind, rtpParameters });
          console.log(`[mediasoup] New audio Producer created successfully. ID: ${producer.id}`);
          producers.set(producer.id, producer);

          const pipeline = sessionPipelines.get(sessionId);
          if (pipeline) {
            pipeline.mediasoupProducers.add(producer.id);
          }

          ws.send(JSON.stringify({
            type: 'produced',
            id: producer.id
          }));

          console.log(`[Signaling] Pipeline starting for session ${sessionId}...`);
          startSttPipeline(producer, sessionId, ws);
          break;
        }

        case 'interrupt': {
          console.log(`[Signaling] Interruption request received for session ${sessionId}`);
          cancelActiveTurn(sessionId);
          await setSessionState(sessionId, 'listening');
          await resetSilenceTimer(sessionId, ws);

          // Log interruption event
          prisma.sessionEvent.create({
            data: {
              sessionId,
              eventType: 'interruption',
              metadata: { timestamp: new Date().toISOString() }
            }
          }).catch(err => console.error('[Database Log Error] Failed to log interruption event:', err));

          // Clean up latency tracker on interruption
          activeTurnLatencies.delete(sessionId);
          break;
        }

        case 'playback_complete': {
          console.log(`[Signaling] Playback complete event received for session ${sessionId}`);
          await setSessionState(sessionId, 'listening');
          await resetSilenceTimer(sessionId, ws);

          // Log latency event
          const latencies = activeTurnLatencies.get(sessionId);
          if (latencies && latencies.firstTokenTime && latencies.firstAudioTime) {
            const utteranceEndToFirstToken = latencies.firstTokenTime - latencies.turnStartTime;
            const firstTokenToFirstAudio = latencies.firstAudioTime - latencies.firstTokenTime;
            const totalTurn = Date.now() - latencies.turnStartTime;

            // Retrieve STT duration recorded on pipeline
            const pipeline = sessionPipelines.get(sessionId);
            const sttDurationMs = (pipeline as any)?.lastSttDurationMs || 0;
            const local_pipeline_ms = (pipeline as any)?.local_pipeline_ms || 0;
            const deepgram_network_rtt_ms = (pipeline as any)?.deepgram_network_rtt_ms || 0;
            const deepgram_processing_ms = (pipeline as any)?.deepgram_processing_ms || 0;
            const interim_transcript_count = (pipeline as any)?.interim_transcript_count || 0;

            // Calculate average TTS chunk duration
            const ttsChunkDurations = (latencies as any).ttsChunkDurations || [];
            const avgTtsDurationMs = ttsChunkDurations.length > 0
              ? Math.round(ttsChunkDurations.reduce((a: number, b: number) => a + b, 0) / ttsChunkDurations.length)
              : 0;

            const llmDurationMs = (latencies as any).llmDurationMs || 0;
            const firstTokenMs = utteranceEndToFirstToken; // from turn start to first token

            // Calculate LLM sub-components
            const networkToOpenAiMs = (latencies as any).firstTokenTime && (latencies as any).llmStartTime
              ? (latencies as any).firstTokenTime - (latencies as any).llmStartTime
              : 0;
            const generationMs = llmDurationMs > networkToOpenAiMs
              ? llmDurationMs - networkToOpenAiMs
              : 0;

            // Calculate TTS sub-components
            const ttsNetworkDurations = (latencies as any).ttsNetworkDurations || [];
            const avgNetworkToDeepgramTtsMs = ttsNetworkDurations.length > 0
              ? Math.round(ttsNetworkDurations.reduce((a: number, b: number) => a + b, 0) / ttsNetworkDurations.length)
              : 0;

            const ttsRelayDurations = (latencies as any).ttsRelayDurations || [];
            const avgAudioRelayToClientMs = ttsRelayDurations.length > 0
              ? Math.round(ttsRelayDurations.reduce((a: number, b: number) => a + b, 0) / ttsRelayDurations.length)
              : 0;

            const clientBufferToPlaybackMs = Number(data.clientMetrics?.clientBufferToPlaybackMs) || 0;

            prisma.sessionEvent.create({
              data: {
                sessionId,
                eventType: 'turn_latency',
                metadata: {
                  utteranceEndToFirstTokenMs: utteranceEndToFirstToken,
                  firstTokenToFirstAudioMs: firstTokenToFirstAudio,
                  totalTurnMs: totalTurn,
                  
                  // Component-based durations
                  sttDurationMs,
                  llmDurationMs,
                  firstTokenMs,
                  ttsDurationMs: avgTtsDurationMs,

                  // Sub-component level latency metrics
                  networkToOpenAiMs,
                  generationMs,
                  networkToDeepgramTtsMs: avgNetworkToDeepgramTtsMs,
                  audioRelayToClientMs: avgAudioRelayToClientMs,
                  clientBufferToPlaybackMs,
                  
                  // STT sub-components annotations/placeholders
                  micToMediasoupMs: null,
                  mediasoupToFfmpegMs: null,
                  ffmpegTranscodeMs: null,
                  deepgramNetworkAndEndpointingMs: sttDurationMs,

                  // 5 lightweight sub-breakdown metrics
                  deepgram_wait_ms: 1300,
                  stt_network_and_compute_ms: Math.max(0, sttDurationMs - 1300),
                  llm_network_ms: networkToOpenAiMs,
                  llm_generation_ms: generationMs,
                  tts_network_and_synthesis_ms: avgNetworkToDeepgramTtsMs,

                  // STT sub-components breakdown details
                  mediasoup_to_ffmpeg_ms: null,
                  ffmpeg_transcode_ms: null,
                  deepgram_network_and_compute_ms: Math.max(0, sttDurationMs - 1300),

                  // Granular STT metrics
                  local_pipeline_ms,
                  deepgram_network_rtt_ms,
                  deepgram_processing_ms,
                  interim_transcript_count
                }
              }
            }).catch(err => console.error('[Database Log Error] Failed to log turn latency event:', err));

            activeTurnLatencies.delete(sessionId);
          }
          break;
        }

        default:
          console.warn('[Signaling] Unknown signaling type:', data.type);
      }
    } catch (err: any) {
      console.error('[Signaling Error]', err);
      ws.send(JSON.stringify({ type: 'error', message: err?.message || 'Internal signaling error' }));
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket Close] Session ID: ${sessionId}`);
    endSessionPipeline(sessionId, ws);
  });
}

async function startSttPipeline(producer: any, sessionId: string, clientWs: WebSocket) {
  let ffmpegProcess: any = null;
  let deepgramWs: WebSocket | null = null;
  let plainTransport: any = null;
  let consumer: any = null;
  
  const sdpPath = path.join(os.tmpdir(), `session-${sessionId}-${Date.now()}.sdp`);

  // Register cleanup on socket drop via unified endSessionPipeline
  clientWs.on('close', () => endSessionPipeline(sessionId, clientWs));
  clientWs.on('error', () => endSessionPipeline(sessionId, clientWs));

  try {
    // 1. Allocate dynamic port
    const ffmpegPort = await findFreeUdpPort();
    console.log(`[Pipeline] Allocated UDP port ${ffmpegPort} for FFmpeg transcode.`);

    // 2. Create PlainTransport
    const router = getRouter();
    console.log(`[Pipeline] Creating PlainTransport...`);
    plainTransport = await router.createPlainTransport({
      listenIp: '127.0.0.1',
      rtcpMux: true,
      comedia: false
    });

    console.log(`[mediasoup] PlainTransport created. ID: ${plainTransport.id}, localPort: ${plainTransport.tuple.localPort}`);

    const pipeline = sessionPipelines.get(sessionId);
    if (pipeline) {
      pipeline.plainTransport = plainTransport;
      pipeline.sdpPath = sdpPath;
    }

    // 3. Connect to FFmpeg destination port
    console.log(`[Pipeline] Connecting PlainTransport to destination 127.0.0.1:${ffmpegPort}...`);
    await plainTransport.connect({
      ip: '127.0.0.1',
      port: ffmpegPort
    });
    console.log(`[mediasoup] PlainTransport connected successfully to destination.`);

    // 4. Create Consumer for Opus audio stream
    console.log(`[Pipeline] Consuming audio producer ${producer.id} on PlainTransport...`);
    consumer = await plainTransport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities
    });
    console.log(`[mediasoup] Consumer created. ID: ${consumer.id}, type: ${consumer.type}, rtpParameters:`, JSON.stringify(consumer.rtpParameters));
    await consumer.resume();
    console.log(`[mediasoup] Consumer resumed successfully.`);

    if (pipeline) {
      pipeline.consumer = consumer;
    }

    // 5. Write SDP description file for FFmpeg to consume Opus RTP stream
    const payloadType = consumer.rtpParameters.codecs[0].payloadType;
    const sdpContent = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=Mediasoup RTP Stream
c=IN IP4 127.0.0.1
t=0 0
m=audio ${ffmpegPort} RTP/AVP ${payloadType}
a=rtpmap:${payloadType} opus/48000/2
a=rtcp-mux
`;
    console.log(`[Pipeline] Writing SDP configuration file to: ${sdpPath}`);
    console.log(`[Pipeline] SDP content:\n${sdpContent}`);
    fs.writeFileSync(sdpPath, sdpContent);

    // 6. Retrieve decrypted Deepgram API Key
    console.log(`[Pipeline] Retrieving Deepgram credential for user ${DEFAULT_USER_ID}...`);
    const credential = await prisma.apiCredential.findFirst({
      where: { userId: DEFAULT_USER_ID, provider: 'deepgram' }
    });

    if (!credential) {
      throw new Error('Deepgram API credentials not configured. Please configure them on the setup page.');
    }

    const apiKey = decrypt(credential.encryptedKey);
    console.log(`[Pipeline] Successfully decrypted Deepgram API Key (starts with: ${apiKey.substring(0, 4)}...).`);

    // 7. Establish Deepgram live transcription WebSocket connection
    const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&interim_results=true&utterance_end_ms=1000&endpointing=300&vad_events=true';
    console.log(`[Deepgram Connection] Connecting to WebSocket URL: ${deepgramUrl}`);
    deepgramWs = new WebSocket(deepgramUrl, {
      headers: {
        Authorization: `Token ${apiKey}`
      }
    });

    deepgramWs.on('open', async () => {
      console.log('[Deepgram Connection] WebSocket connection successfully opened with Deepgram.');
      await setNudgeCount(sessionId, 0);
      await resetSilenceTimer(sessionId, clientWs);

      const pl = sessionPipelines.get(sessionId);
      if (pl) {
        pl.deepgramWs = deepgramWs;
        (pl as any).deepgramOpenTime = Date.now();
      }

      // Verify that ffmpeg exists (fails loudly check)
      if (!ffmpegPath) {
        throw new Error('FFmpeg path is not defined. ffmpeg-static could not load properly.');
      }

      // 8. Spawn FFmpeg child process to transcode Opus RTP packets to raw 16kHz PCM
      const ffmpegArgs = [
        '-protocol_whitelist', 'file,rtp,udp',
        '-i', sdpPath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ac', '1',
        '-ar', '16000',
        'pipe:1'
      ];
      console.log(`[FFmpeg Spawn] Spawning FFmpeg binary at: ${ffmpegPath}`);
      console.log(`[FFmpeg Spawn] Arguments: ${ffmpegArgs.join(' ')}`);

      ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
      if (pl) {
        pl.ffmpegProcess = ffmpegProcess;
      }

      ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        // Log brief status of incoming PCM packets occasionally to avoid flooding console, but verify bytes flow
        if (Math.random() < 0.05) {
          console.log(`[FFmpeg output] Transcoded PCM chunk: ${chunk.length} bytes.`);
        }
        if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(chunk);
          const currentPipeline = sessionPipelines.get(sessionId);
          if (currentPipeline) {
            currentPipeline.totalBytesSent = (currentPipeline.totalBytesSent || 0) + chunk.length;
            const streamTime = currentPipeline.totalBytesSent / 32000;
            currentPipeline.chunksLog = currentPipeline.chunksLog || [];
            currentPipeline.chunksLog.push({ streamTime, sentTime: Date.now() });
          }
        }
      });

      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        // Output all ffmpeg logging in real-time
        console.log(`[FFmpeg Stderr] ${data.toString().trim()}`);
      });

      ffmpegProcess.on('close', (code: number) => {
        console.log(`[FFmpeg process] Finished with exit code ${code}`);
      });
    });

    let lastWordEndTimeInStream = 0;

    deepgramWs.on('message', async (messageData: WebSocket.Data) => {
      const now = Date.now();
      if (!sessionPipelines.has(sessionId)) {
        console.log(`[Deepgram Message] Session ${sessionId} has been terminated. Ignoring transcript event.`);
        return;
      }
      console.log(`[Deepgram Raw Message Received]:`, messageData.toString());
      try {
        const response = JSON.parse(messageData.toString());
        const pipeline = sessionPipelines.get(sessionId);
        
        // Log response endTime to responsesLog if it is a Results type message
        if (pipeline && typeof response.start === 'number' && typeof response.duration === 'number') {
          const responseEndTime = response.start + response.duration;
          pipeline.responsesLog = pipeline.responsesLog || [];
          pipeline.responsesLog.push({ responseEndTime, recvTime: now });
        }
        const alternatives = response.channel?.alternatives?.[0];
        const words = alternatives?.words || [];
        if (words.length > 0) {
          const lastWord = words[words.length - 1];
          if (lastWord && typeof lastWord.end === 'number') {
            lastWordEndTimeInStream = lastWord.end;
          }
        }

        const transcript = alternatives?.transcript || '';

        if (transcript.trim()) {
          // Suspend silence timer during active speech
          await setNudgeCount(sessionId, 0);
          stopSilenceTimer(sessionId);
        }

        if (response.is_final) {
          if (transcript.trim()) {
            console.log(`[Deepgram Final Transcript]: ${transcript}`);
            
            // Relay final transcript to client
            clientWs.send(JSON.stringify({
              type: 'transcript',
              isFinal: true,
              text: transcript
            }));

            // Accumulate speech in Redis
            const currentSpeech = await getSessionSpeech(sessionId);
            const updatedSpeech = (currentSpeech + ' ' + transcript.trim()).trim();
            await setSessionSpeech(sessionId, updatedSpeech);
          }
        } else {
          if (transcript.trim()) {
            console.log(`[Deepgram Interim Transcript]: ${transcript}`);
            if (pipeline) {
              pipeline.interimTranscriptCount = (pipeline.interimTranscriptCount || 0) + 1;
            }
            // Relay interim transcript to client
            clientWs.send(JSON.stringify({
              type: 'transcript',
              isFinal: false,
              text: transcript
            }));
          }
        }

        // Handle Deepgram UtteranceEnd event
        if (response.type === 'UtteranceEnd') {
          console.log('[Deepgram Event] UtteranceEnd detected (Speech pause completed).');

          const pipeline = sessionPipelines.get(sessionId);
          const deepgramOpenTime = (pipeline as any)?.deepgramOpenTime || (Date.now() - 2000);
          const speechEndTimeReal = lastWordEndTimeInStream > 0 
            ? deepgramOpenTime + lastWordEndTimeInStream * 1000
            : Date.now() - 1000; // fallback to 1s ago (silence window)
          
          const sttDuration = Date.now() - speechEndTimeReal;
          if (pipeline) {
            (pipeline as any).lastSttDurationMs = sttDuration;
            
            // Calculate granular STT latency breakdown
            const sttNetworkAndComputeMs = Math.max(0, sttDuration - 1300);

            // 1. Find sentStopVal (closest streamTime in chunksLog)
            let sentStopVal = deepgramOpenTime + lastWordEndTimeInStream * 1000; // fallback
            if (pipeline.chunksLog && pipeline.chunksLog.length > 0 && lastWordEndTimeInStream > 0) {
              let minDiff = Infinity;
              for (const chunk of pipeline.chunksLog) {
                const diff = Math.abs(chunk.streamTime - lastWordEndTimeInStream);
                if (diff < minDiff) {
                  minDiff = diff;
                  sentStopVal = chunk.sentTime;
                }
              }
            }

            // 2. Find firstResponseTime (first responseEndTime >= lastWordEndTimeInStream)
            let firstResponseTime = Date.now(); // fallback
            if (pipeline.responsesLog && pipeline.responsesLog.length > 0 && lastWordEndTimeInStream > 0) {
              for (const resp of pipeline.responsesLog) {
                if (resp.responseEndTime >= lastWordEndTimeInStream) {
                  firstResponseTime = resp.recvTime;
                  break;
                }
              }
            }

            // Clamp firstResponseTime to sentStopVal if needed
            if (firstResponseTime < sentStopVal) {
              firstResponseTime = sentStopVal;
            }

            const clientStopTime = deepgramOpenTime + lastWordEndTimeInStream * 1000;
            const local_pipeline_ms = Math.max(0, sentStopVal - clientStopTime);
            const deepgram_network_rtt_ms = Math.max(0, firstResponseTime - sentStopVal);
            const deepgram_processing_ms = Math.max(0, sttNetworkAndComputeMs - local_pipeline_ms - deepgram_network_rtt_ms);

            (pipeline as any).local_pipeline_ms = local_pipeline_ms;
            (pipeline as any).deepgram_network_rtt_ms = deepgram_network_rtt_ms;
            (pipeline as any).deepgram_processing_ms = deepgram_processing_ms;
            (pipeline as any).interim_transcript_count = pipeline.interimTranscriptCount || 0;

            console.log(`[STT Granular Metrics] lastWordEndTimeInStream=${lastWordEndTimeInStream}s, clientStopTime=${clientStopTime}, sentStopVal=${sentStopVal}, firstResponseTime=${firstResponseTime}`);
            console.log(`[STT Granular Metrics] local_pipeline_ms=${local_pipeline_ms}ms, deepgram_network_rtt_ms=${deepgram_network_rtt_ms}ms, deepgram_processing_ms=${deepgram_processing_ms}ms, interim_transcript_count=${pipeline.interimTranscriptCount}`);

            // Clear logs for the next turn
            pipeline.chunksLog = [];
            pipeline.responsesLog = [];
            pipeline.totalBytesSent = 0;
            pipeline.interimTranscriptCount = 0;
          }
          console.log(`[STT Latency] Calculated stt_duration_ms: ${sttDuration}ms`);
          
          const fullSpeech = await getSessionSpeech(sessionId);
          if (isTrivialUtterance(fullSpeech)) {
            console.log(`[Speech Guard] Ignoring trivial/filler utterance: "${fullSpeech}". Continuing to listen.`);
            // Send utteranceEnd event to client so they know we processed it but kept listening
            clientWs.send(JSON.stringify({
              type: 'utteranceEnd'
            }));
            // Restart silence timer since we didn't trigger an LLM turn
            await resetSilenceTimer(sessionId, clientWs);
          } else {
            console.log(`[Speech Guard] Non-trivial utterance detected: "${fullSpeech}". Triggering LLM turn.`);
            
            // Persist the combined final transcript to the database and Redis history cache
            try {
              await prisma.message.create({
                data: {
                  sessionId,
                  role: 'user',
                  content: fullSpeech
                }
              });
              console.log(`[Database Log] Successfully inserted combined message row in database.`);
              await appendSessionHistory(sessionId, { role: 'user', content: fullSpeech });
            } catch (dbErr) {
              console.error('[Database Log Error] Error logging user message to database:', dbErr);
            }

            // Clear the speech map in Redis
            await deleteSessionSpeech(sessionId);

            // Notify client of utteranceEnd
            clientWs.send(JSON.stringify({
              type: 'utteranceEnd'
            }));
            
            console.log(`[Pipeline] Triggering LLM turn for session ${sessionId}...`);
            triggerLlmTurn(sessionId, clientWs);
          }
          // Reset lastWordEndTimeInStream for the next turn
          lastWordEndTimeInStream = 0;
        }
      } catch (parseErr) {
        console.error('[Deepgram Parsing Error] Error parsing Deepgram message:', parseErr);
      }
    });

    deepgramWs.on('error', (err) => {
      console.error('[Deepgram WS Connection Error]:', err);
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'deepgram_stt',
            errorType: 'websocket_error',
            message: err?.message || 'Deepgram STT connection error'
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
    });

    deepgramWs.on('close', (code, reason) => {
      console.log(`[Deepgram Connection Closed] Code: ${code}, Reason: ${reason}`);
      if (code !== 1000 && code !== 1005) {
        prisma.sessionEvent.create({
          data: {
            sessionId,
            eventType: 'provider_error',
            metadata: {
              provider: 'deepgram_stt',
              errorType: 'connection_closed',
              message: `Deepgram connection closed abnormally. Code: ${code}, Reason: ${reason || 'Unknown reason'}`
            }
          }
        }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
      }
      endSessionPipeline(sessionId);
    });

  } catch (error: any) {
    console.error('[Pipeline Execution Failure]', error);
    clientWs.send(JSON.stringify({ type: 'error', message: error?.message || 'Failed to start STT pipeline' }));
    endSessionPipeline(sessionId);
  }
}



function cancelActiveTurn(sessionId: string) {
  const context = activeSessions.get(sessionId);
  if (context) {
    console.log(`[Cancel Turn] Cancelling active LLM/TTS turn for session: ${sessionId}`);
    if (context.abortController) {
      context.abortController.abort();
      context.abortController = null;
    }
    if (context.ttsWorker) {
      context.ttsWorker.cancel();
      context.ttsWorker = null;
    }
    activeSessions.delete(sessionId);
  }
}

async function getDeepgramTts(sessionId: string, text: string, voice: string, apiKey: string): Promise<Buffer> {
  try {
    const ttsReqStart = Date.now();
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({ text })
    });
    const networkToTtsMs = Date.now() - ttsReqStart;

    const latencies = activeTurnLatencies.get(sessionId);
    if (latencies) {
      if (!(latencies as any).ttsNetworkDurations) {
        (latencies as any).ttsNetworkDurations = [];
      }
      (latencies as any).ttsNetworkDurations.push(networkToTtsMs);
    }

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      const errorType = status === 401 ? 'auth_error' : status === 429 ? 'rate_limit' : 'api_error';
      const msg = `Deepgram TTS API error: ${status} - ${errText}`;
      
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'deepgram_tts',
            errorType,
            message: msg
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
      
      throw new Error(msg);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error('[Deepgram TTS Network/Fetch Error]', error);
    if (!error.message.includes('Deepgram TTS API error:')) {
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'deepgram_tts',
            errorType: 'fetch_error',
            message: error?.message || 'Network/connection error'
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
    }
    throw error;
  }
}

class TtsQueueWorker {
  private queue: string[] = [];
  private active = false;
  private cancelled = false;
  private streamFinished = false;

  constructor(
    private sessionId: string,
    private voice: string,
    private apiKey: string,
    private clientWs: WebSocket
  ) {}

  push(sentence: string) {
    if (this.cancelled) return;
    this.queue.push(sentence);
    this.processNext();
  }

  cancel() {
    this.cancelled = true;
    this.queue = [];
  }

  markStreamFinished() {
    this.streamFinished = true;
    this.processNext();
  }

  private async processNext() {
    if (this.active || this.cancelled) return;

    if (this.queue.length === 0) {
      if (this.streamFinished) {
        console.log(`[TTS Worker] Queue empty and stream finished. Cleaning up worker. Sending tts_done to client.`);
        activeSessions.delete(this.sessionId);
        if (this.clientWs.readyState === WebSocket.OPEN) {
          this.clientWs.send(JSON.stringify({ type: 'tts_done' }));
        }
      }
      return;
    }

    this.active = true;
    const sentence = this.queue.shift()!;
    try {
      console.log(`[TTS Worker] Generating TTS for: "${sentence}" using voice ${this.voice}`);
      const ttsChunkStart = Date.now();
      const audioBuffer = await getDeepgramTts(this.sessionId, sentence, this.voice, this.apiKey);
      const ttsChunkDuration = Date.now() - ttsChunkStart;

      // Record first audio chunk generated latency checkpoint
      const latencies = activeTurnLatencies.get(this.sessionId);
      if (latencies) {
        if (!latencies.firstAudioTime) {
          latencies.firstAudioTime = Date.now();
        }
        if (!(latencies as any).ttsChunkDurations) {
          (latencies as any).ttsChunkDurations = [];
        }
        (latencies as any).ttsChunkDurations.push(ttsChunkDuration);
      }

      if (!this.cancelled) {
        console.log(`[TTS Worker] Audio chunk generated (${audioBuffer.length} bytes). Sending to client.`);
        const relayStart = Date.now();
        this.clientWs.send(JSON.stringify({
          type: 'audio_chunk',
          audio: audioBuffer.toString('base64')
        }));
        const relayMs = Date.now() - relayStart;

        if (latencies) {
          if (!(latencies as any).ttsRelayDurations) {
            (latencies as any).ttsRelayDurations = [];
          }
          (latencies as any).ttsRelayDurations.push(relayMs);
        }
      }
    } catch (err) {
      console.error('[TTS Worker Error] TTS generation failed:', err);
    } finally {
      this.active = false;
      this.processNext();
    }
  }
}

async function triggerLlmTurn(sessionId: string, clientWs: WebSocket, isSilenceNudge = false) {
  if (!sessionPipelines.has(sessionId)) {
    console.log(`[triggerLlmTurn] Session ${sessionId} is not active. Aborting turn.`);
    return;
  }

  // State machine guard: double-trigger protection
  const currentState = await getSessionState(sessionId);
  if (currentState !== 'listening') {
    console.log(`[triggerLlmTurn] Session ${sessionId} is currently in state "${currentState}". Guarding against double-trigger.`);
    return;
  }

  // Transition to thinking state and stop silence timer
  await setSessionState(sessionId, 'thinking');
  stopSilenceTimer(sessionId);

  try {
    // 1. Load session and config version
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { agentConfigVersion: true }
    });

    if (!session || !session.agentConfigVersion) {
      throw new Error(`Session or Agent Config Version not found for session ${sessionId}`);
    }

    const agentConfig = session.agentConfigVersion;

    // 2. Assemble system prompt
    let systemPrompt = agentConfig.systemPrompt;
    const hasContext = 
      agentConfig.jobDescription || 
      agentConfig.candidateResume || 
      agentConfig.interviewPreferences || 
      agentConfig.interviewDurationMinutes || 
      agentConfig.uploadedQuestions;

    if (hasContext) {
      let contextBlock = '\n\n--- CONTEXT ---\n';
      if (agentConfig.jobDescription) {
        contextBlock += `Job Description: ${agentConfig.jobDescription}\n`;
      }
      if (agentConfig.candidateResume) {
        contextBlock += `Candidate Resume: ${agentConfig.candidateResume}\n`;
      }
      if (agentConfig.interviewPreferences) {
        const prefs = typeof agentConfig.interviewPreferences === 'string'
          ? agentConfig.interviewPreferences
          : JSON.stringify(agentConfig.interviewPreferences);
        contextBlock += `Interview Preferences: ${prefs}\n`;
      }
      if (agentConfig.interviewDurationMinutes) {
        contextBlock += `Interview Duration: ${agentConfig.interviewDurationMinutes} minutes\n`;
      }
      if (agentConfig.uploadedQuestions) {
        const questions = typeof agentConfig.uploadedQuestions === 'string'
          ? agentConfig.uploadedQuestions
          : JSON.stringify(agentConfig.uploadedQuestions);
        contextBlock += `Predefined Questions: ${questions}\n`;
      }
      contextBlock += '---\n\nUse the above context only where relevant to the instructions above.';
      systemPrompt += contextBlock;
    }

    // 3. Load conversation history from Redis (or fallback to DB)
    const messages = await getSessionHistory(sessionId);

    // 4. Retrieve decrypted credentials
    const openAiCredential = await prisma.apiCredential.findFirst({
      where: { userId: DEFAULT_USER_ID, provider: 'openai' }
    });
    if (!openAiCredential) {
      throw new Error('OpenAI API credentials not configured. Please configure them on the setup page.');
    }
    const openAiKey = decrypt(openAiCredential.encryptedKey);

    const deepgramCredential = await prisma.apiCredential.findFirst({
      where: { userId: DEFAULT_USER_ID, provider: 'deepgram' }
    });
    if (!deepgramCredential) {
      throw new Error('Deepgram API credentials not configured. Please configure them on the setup page.');
    }
    const deepgramKey = decrypt(deepgramCredential.encryptedKey);

    // 5. Cancel any in-flight turns and start active turn
    cancelActiveTurn(sessionId);

    // Track latency checkpoints for the new turn
    activeTurnLatencies.set(sessionId, { turnStartTime: Date.now() });

    const abortController = new AbortController();
    const voicePreference = agentConfig.voicePreference || 'aura-asteria-en';
    const ttsWorker = new TtsQueueWorker(sessionId, voicePreference, deepgramKey, clientWs);
    activeSessions.set(sessionId, { abortController, ttsWorker });

    // 6. Construct OpenAI payload messages
    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
    ];

    if (isSilenceNudge) {
      openAiMessages.push({
        role: 'system',
        content: '[System Reminder: The user has been silent for 15 seconds. Output a brief nudge (one or two sentences) in your persona to check in on them and prompt them to continue the conversation.]'
      });
    }

    console.log(`[LLM Turn] Calling OpenAI with model ${agentConfig.llmModel}. History length: ${openAiMessages.length} messages.`);

    const llmStartTime = Date.now();
    const currentLatencies = activeTurnLatencies.get(sessionId);
    if (currentLatencies) {
      (currentLatencies as any).llmStartTime = llmStartTime;
    }

    // 7. Request streaming completions from OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: agentConfig.llmModel,
        messages: openAiMessages,
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
      const errorType = status === 401 ? 'auth_error' : status === 429 ? 'rate_limit' : 'api_error';
      const msg = `OpenAI API error: ${status} - ${errorText}`;
      
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'openai',
            errorType,
            message: msg
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));

      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Readable stream not supported on OpenAI response.');
    }

    const decoder = new TextDecoder('utf8');
    let buffer = '';
    let sentenceBuffer = '';
    let fullResponse = '';

    // Notify client that LLM started responding
    clientWs.send(JSON.stringify({
      type: 'llm_start'
    }));
    await setSessionState(sessionId, 'speaking');
    stopSilenceTimer(sessionId);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') break;
        if (cleanLine.startsWith('data: ')) {
          const jsonStr = cleanLine.substring(6);
          try {
            const parsed = JSON.parse(jsonStr);

            // Log token usage if included in the stream (will be sent in the final chunk)
            if (parsed.usage) {
              const { prompt_tokens, completion_tokens, total_tokens } = parsed.usage;
              prisma.sessionEvent.create({
                data: {
                  sessionId,
                  eventType: 'token_usage',
                  metadata: {
                    promptTokens: prompt_tokens,
                    completionTokens: completion_tokens,
                    totalTokens: total_tokens
                  }
                }
              }).catch(err => console.error('[Database Log Error] Failed to log token usage event:', err));
            }

            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              // Record first token latency checkpoint
              const latencies = activeTurnLatencies.get(sessionId);
              if (latencies && !latencies.firstTokenTime) {
                latencies.firstTokenTime = Date.now();
              }

              fullResponse += content;
              sentenceBuffer += content;

              // Relay tokens to client over WebSocket
              clientWs.send(JSON.stringify({
                type: 'llm_chunk',
                text: content
              }));

              // Check for sentence boundaries: match punctuation followed by whitespace or end of stream
              let boundaryIndex = -1;
              while (true) {
                boundaryIndex = -1;
                for (let i = 0; i < sentenceBuffer.length; i++) {
                  const char = sentenceBuffer[i];
                  if (char === '.' || char === '!' || char === '?') {
                    if (i === sentenceBuffer.length - 1 || /\s/.test(sentenceBuffer[i + 1])) {
                      boundaryIndex = i;
                      break;
                    }
                  }
                }

                if (boundaryIndex !== -1) {
                  const sentence = sentenceBuffer.substring(0, boundaryIndex + 1).trim();
                  sentenceBuffer = sentenceBuffer.substring(boundaryIndex + 1);
                  if (sentence) {
                    ttsWorker.push(sentence);
                  }
                } else {
                  break;
                }
              }
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    // Push the remaining sentence if any
    if (sentenceBuffer.trim()) {
      ttsWorker.push(sentenceBuffer.trim());
    }
    ttsWorker.markStreamFinished();

    const llmDuration = Date.now() - llmStartTime;
    const latenciesObj = activeTurnLatencies.get(sessionId);
    if (latenciesObj) {
      (latenciesObj as any).llmDurationMs = llmDuration;
    }

    // 8. Log assistant turn to database and Redis history cache
    await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullResponse
      }
    });
    console.log(`[LLM Turn] Assistant response saved to DB (${fullResponse.length} chars).`);
    await appendSessionHistory(sessionId, { role: 'assistant', content: fullResponse });

    // Notify client LLM turn is complete
    clientWs.send(JSON.stringify({
      type: 'llm_done',
      fullText: fullResponse
    }));

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`[LLM Turn Aborted] OpenAI request aborted for session: ${sessionId}`);
    } else {
      console.error('[LLM Turn Error]', error);
      clientWs.send(JSON.stringify({ type: 'error', message: `LLM Error: ${error?.message || 'Internal OpenAI completion failure'}` }));

      if (!error.message.includes('OpenAI API error:')) {
        prisma.sessionEvent.create({
          data: {
            sessionId,
            eventType: 'provider_error',
            metadata: {
              provider: 'openai',
              errorType: 'fetch_error',
              message: error?.message || 'Network/connection error'
            }
          }
        }).catch(dbErr => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
      }
    }
  } finally {
    const state = await getSessionState(sessionId);
    if (state === 'thinking') {
      await setSessionState(sessionId, 'listening');
      if (clientWs.readyState === WebSocket.OPEN) {
        await resetSilenceTimer(sessionId, clientWs);
      }
    }
  }
}
