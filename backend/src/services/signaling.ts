import WebSocket from 'ws';
import { getRouter } from './mediasoup';
import { findFreeUdpPort } from '../utils/ports';
import prisma from '../db/client';
import { DEFAULT_USER_ID } from '../index';
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
}

export const sessionPipelines = new Map<string, SessionPipeline>();

const activeSessions = new Map<string, {
  abortController: AbortController | null;
  ttsWorker: TtsQueueWorker | null;
}>();

// Silence/pause detection variables
const silenceTimers = new Map<string, NodeJS.Timeout>();
const nudgeCounts = new Map<string, number>();
const SILENCE_TIMEOUT_MS = 15000; // 15 seconds
const MAX_NUDGES = 3;
export const sessionStates = new Map<string, 'listening' | 'thinking' | 'speaking'>();
export const sessionSpeechMap = new Map<string, string>();

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
  sessionStates.delete(sessionId);
  sessionSpeechMap.delete(sessionId);

  console.log(`[endSessionPipeline] Force terminating session pipeline for ${sessionId}`);

  // 1. Clear timers and cancel LLM/TTS active turn
  clearSilenceTimer(sessionId);
  cancelActiveTurn(sessionId);

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
  nudgeCounts.delete(sessionId);
}

function stopSilenceTimer(sessionId: string) {
  const timer = silenceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    silenceTimers.delete(sessionId);
  }
}

function resetSilenceTimer(sessionId: string, clientWs: WebSocket) {
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
  const currentState = sessionStates.get(sessionId) || 'listening';
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
      const state = sessionStates.get(sessionId) || 'listening';
      if (state !== 'listening') {
        console.log(`[Silence Handler] State changed to ${state} during timeout, ignoring nudge trigger.`);
        return;
      }
      if (activeSessions.has(sessionId)) {
        // If the assistant is currently speaking or generating, check again in 15s
        resetSilenceTimer(sessionId, clientWs);
        return;
      }

      const nudgeCount = nudgeCounts.get(sessionId) || 0;
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
      nudgeCounts.set(sessionId, nudgeCount + 1);

      // Trigger synthetic LLM turn
      await triggerLlmTurn(sessionId, clientWs, true);

      // Reset the timer for the next check
      resetSilenceTimer(sessionId, clientWs);
    } catch (err) {
      console.error('[Silence Handler Error]', err);
    }
  }, SILENCE_TIMEOUT_MS);

  silenceTimers.set(sessionId, timer);
}

export function handleSignaling(ws: WebSocket, sessionId: string) {
  console.log(`[WebSocket Open] Session ID: ${sessionId}`);

  // Reconnect cleanup safety: Cancel active turn, reset state to 'listening'
  cancelActiveTurn(sessionId);
  sessionStates.set(sessionId, 'listening');
  sessionSpeechMap.delete(sessionId);
  clearSilenceTimer(sessionId);

  sessionPipelines.set(sessionId, {
    clientWs: ws,
    deepgramWs: null,
    ffmpegProcess: null,
    consumer: null,
    plainTransport: null,
    sdpPath: '',
    mediasoupTransports: new Set<string>(),
    mediasoupProducers: new Set<string>(),
    ended: false
  });

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
          sessionStates.set(sessionId, 'listening');
          resetSilenceTimer(sessionId, ws);
          break;
        }

        case 'playback_complete': {
          console.log(`[Signaling] Playback complete event received for session ${sessionId}`);
          sessionStates.set(sessionId, 'listening');
          resetSilenceTimer(sessionId, ws);
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

    deepgramWs.on('open', () => {
      console.log('[Deepgram Connection] WebSocket connection successfully opened with Deepgram.');
      nudgeCounts.set(sessionId, 0);
      resetSilenceTimer(sessionId, clientWs);

      const pl = sessionPipelines.get(sessionId);
      if (pl) {
        pl.deepgramWs = deepgramWs;
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

    deepgramWs.on('message', async (messageData: WebSocket.Data) => {
      if (!sessionPipelines.has(sessionId)) {
        console.log(`[Deepgram Message] Session ${sessionId} has been terminated. Ignoring transcript event.`);
        return;
      }
      console.log(`[Deepgram Raw Message Received]:`, messageData.toString());
      try {
        const response = JSON.parse(messageData.toString());
        const transcript = response.channel?.alternatives?.[0]?.transcript || '';

        if (transcript.trim()) {
          // Suspend silence timer during active speech
          nudgeCounts.set(sessionId, 0);
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

            // Accumulate speech in-memory
            const currentSpeech = (sessionSpeechMap.get(sessionId) || '') + ' ' + transcript.trim();
            sessionSpeechMap.set(sessionId, currentSpeech.trim());
          }
        } else {
          if (transcript.trim()) {
            console.log(`[Deepgram Interim Transcript]: ${transcript}`);
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
          
          const fullSpeech = sessionSpeechMap.get(sessionId) || '';
          if (isTrivialUtterance(fullSpeech)) {
            console.log(`[Speech Guard] Ignoring trivial/filler utterance: "${fullSpeech}". Continuing to listen.`);
            // Send utteranceEnd event to client so they know we processed it but kept listening
            clientWs.send(JSON.stringify({
              type: 'utteranceEnd'
            }));
            // Restart silence timer since we didn't trigger an LLM turn
            resetSilenceTimer(sessionId, clientWs);
          } else {
            console.log(`[Speech Guard] Non-trivial utterance detected: "${fullSpeech}". Triggering LLM turn.`);
            
            // Persist the combined final transcript to the database
            try {
              await prisma.message.create({
                data: {
                  sessionId,
                  role: 'user',
                  content: fullSpeech
                }
              });
              console.log(`[Database Log] Successfully inserted combined message row in database.`);
            } catch (dbErr) {
              console.error('[Database Log Error] Error logging user message to database:', dbErr);
            }

            // Clear the speech map
            sessionSpeechMap.delete(sessionId);

            // Notify client of utteranceEnd
            clientWs.send(JSON.stringify({
              type: 'utteranceEnd'
            }));
            
            console.log(`[Pipeline] Triggering LLM turn for session ${sessionId}...`);
            triggerLlmTurn(sessionId, clientWs);
          }
        }
      } catch (parseErr) {
        console.error('[Deepgram Parsing Error] Error parsing Deepgram message:', parseErr);
      }
    });

    deepgramWs.on('error', (err) => {
      console.error('[Deepgram WS Connection Error]:', err);
    });

    deepgramWs.on('close', (code, reason) => {
      console.log(`[Deepgram Connection Closed] Code: ${code}, Reason: ${reason}`);
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

async function getDeepgramTts(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Deepgram TTS API error: ${response.status} - ${errText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
      const audioBuffer = await getDeepgramTts(sentence, this.voice, this.apiKey);

      if (!this.cancelled) {
        console.log(`[TTS Worker] Audio chunk generated (${audioBuffer.length} bytes). Sending to client.`);
        this.clientWs.send(JSON.stringify({
          type: 'audio_chunk',
          audio: audioBuffer.toString('base64')
        }));
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
  const currentState = sessionStates.get(sessionId) || 'listening';
  if (currentState !== 'listening') {
    console.log(`[triggerLlmTurn] Session ${sessionId} is currently in state "${currentState}". Guarding against double-trigger.`);
    return;
  }

  // Transition to thinking state and stop silence timer
  sessionStates.set(sessionId, 'thinking');
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

    // 3. Load conversation history from DB
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    });

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
        stream: true
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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
    sessionStates.set(sessionId, 'speaking');
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
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
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

    // 8. Log assistant turn to database
    await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: fullResponse
      }
    });
    console.log(`[LLM Turn] Assistant response saved to DB (${fullResponse.length} chars).`);

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
    }
  } finally {
    const state = sessionStates.get(sessionId);
    if (state === 'thinking') {
      sessionStates.set(sessionId, 'listening');
      if (clientWs.readyState === WebSocket.OPEN) {
        resetSilenceTimer(sessionId, clientWs);
      }
    }
  }
}
