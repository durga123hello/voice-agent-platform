import WebSocket from 'ws';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import prisma from '../../db/client';
import { decrypt } from '../../utils/crypto';
import { TelephonyAdapter } from './base';
import { TelephonyAdapterFactory } from './factory';
import { TtsTelephonyWorker } from './ttsWorker';
import {
  getSessionState,
  setSessionState,
  getSessionSpeech,
  setSessionSpeech,
  deleteSessionSpeech,
  getSessionHistory,
  appendSessionHistory,
  setNudgeCount,
  incrementNudgeCount,
  deleteNudgeCount,
  cancelActiveTurn,
  activeSessions,
  activeTurnLatencies,
  isTrivialUtterance
} from '../signaling';

// µ-law to Linear PCM lookup table for zero-latency JS transcoding
const muLawTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let sign = (i & 0x80) ? -1 : 1;
  let exponent = (~i >> 4) & 0x07;
  let mantissa = ~i & 0x0f;
  let sample = (mantissa << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  muLawTable[i] = sign * sample;
}

function decodeMuLawToPcm(mulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    const pcmSample = muLawTable[mulawBuffer[i]];
    pcmBuffer.writeInt16LE(pcmSample, i * 2);
  }
  return pcmBuffer;
}

function resamplePcm8kHzTo16kHz(pcm8kHz: Buffer): Buffer {
  const numSamples = pcm8kHz.length / 2;
  const pcm16kHz = Buffer.alloc(numSamples * 4);
  for (let i = 0; i < numSamples; i++) {
    const val = pcm8kHz.readInt16LE(i * 2);
    pcm16kHz.writeInt16LE(val, i * 4);
    pcm16kHz.writeInt16LE(val, i * 4 + 2);
  }
  return pcm16kHz;
}

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

interface TelephonyPipeline {
  adapter: TelephonyAdapter;
  deepgramWs: WebSocket | null;
  ffmpegProcess: any | null;
  ended: boolean;
}

const telephonyPipelines = new Map<string, TelephonyPipeline>();
const telephonySilenceTimers = new Map<string, NodeJS.Timeout>();

export function clearTelephonySilenceTimer(sessionId: string) {
  const timer = telephonySilenceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    telephonySilenceTimers.delete(sessionId);
  }
}

export function resetTelephonySilenceTimer(sessionId: string, adapter: TelephonyAdapter) {
  clearTelephonySilenceTimer(sessionId);

  const timer = setTimeout(async () => {
    try {
      console.log(`[Telephony Silence Timer] 15s of silence detected for session ${sessionId}. Triggering nudge...`);
      const count = await incrementNudgeCount(sessionId);
      if (count <= 3) {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { agentConfigVersion: true }
        });

        if (session && session.agentConfigVersion) {
          const deepgramCredential = await prisma.apiCredential.findFirst({
            where: { userId: DEFAULT_USER_ID, provider: 'deepgram' }
          });
          const openAiCredential = await prisma.apiCredential.findFirst({
            where: { userId: DEFAULT_USER_ID, provider: 'openai' }
          });

          if (deepgramCredential && openAiCredential) {
            const deepgramKey = decrypt(deepgramCredential.encryptedKey);
            const openAiKey = decrypt(openAiCredential.encryptedKey);

            triggerTelephonyLlmTurn(
              sessionId,
              adapter,
              session,
              session.agentConfigVersion,
              openAiKey,
              deepgramKey,
              true // isSilenceNudge
            );
          }
        }
      } else {
        console.log(`[Telephony Silence Timer] Max nudges (3) reached. Terminating call.`);
        adapter.close();
      }
    } catch (err) {
      console.error('[Telephony Silence Nudge Error] Failed to process nudge:', err);
    }
  }, 15000);

  telephonySilenceTimers.set(sessionId, timer);
}

export async function handleTelephonyBargeIn(sessionId: string, adapter: TelephonyAdapter) {
  const state = await getSessionState(sessionId);
  if (state !== 'speaking') return;

  console.log(`[Telephony Barge-in] Interruption detected. Stopping LLM/TTS generation.`);
  cancelActiveTurn(sessionId);
  await setSessionState(sessionId, 'listening');
  await adapter.clearAudio();
  resetTelephonySilenceTimer(sessionId, adapter);

  prisma.sessionEvent.create({
    data: {
      sessionId,
      eventType: 'interruption',
      metadata: { timestamp: new Date().toISOString() }
    }
  }).catch((err) => console.error('[Database Log Error] Failed to log interruption event:', err));
}

export function handleTelephony(ws: WebSocket, provider: string, sessionId: string) {
  console.log(`[Telephony Connect] Session ID: ${sessionId}, Provider: ${provider}`);
  
  const adapter = TelephonyAdapterFactory.create(provider, ws);
  
  const pipeline: TelephonyPipeline = {
    adapter,
    deepgramWs: null,
    ffmpegProcess: null,
    ended: false
  };
  telephonyPipelines.set(sessionId, pipeline);

  cancelActiveTurn(sessionId);
  clearTelephonySilenceTimer(sessionId);

  Promise.all([
    setSessionState(sessionId, 'listening'),
    deleteSessionSpeech(sessionId),
    deleteNudgeCount(sessionId)
  ]).then(() => {
    console.log(`[Telephony Init] Session keys for ${sessionId} initialized in Redis.`);
  }).catch(err => {
    console.error('[Telephony Init Error] Failed to initialize Redis state:', err);
  });

  adapter.on('start', async (metadata) => {
    try {
      console.log(`[Telephony Start Event] Call connected:`, metadata);
      
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { agentConfigVersion: true }
      });

      if (!session || !session.agentConfigVersion) {
        throw new Error(`Session or Config Version not found for session ${sessionId}`);
      }

      // Decrypt credentials
      const deepgramCredential = await prisma.apiCredential.findFirst({
        where: { userId: DEFAULT_USER_ID, provider: 'deepgram' }
      });
      if (!deepgramCredential) {
        throw new Error('Deepgram API credentials not configured.');
      }
      const deepgramKey = decrypt(deepgramCredential.encryptedKey);

      const openAiCredential = await prisma.apiCredential.findFirst({
        where: { userId: DEFAULT_USER_ID, provider: 'openai' }
      });
      if (!openAiCredential) {
        throw new Error('OpenAI API credentials not configured.');
      }
      const openAiKey = decrypt(openAiCredential.encryptedKey);

      // Start Deepgram Live STT WebSocket
      const deepgramHost = process.env.DEEPGRAM_MOCK_URL || 'wss://api.deepgram.com';
      const deepgramUrl = `${deepgramHost}/v1/listen?encoding=linear16&sample_rate=16000&channels=1&interim_results=true&utterance_end_ms=1000&endpointing=300&vad_events=true`;
      
      console.log(`[Telephony STT] Connecting to Deepgram STT URL: ${deepgramUrl}`);
      const dgWs = new WebSocket(deepgramUrl, {
        headers: { Authorization: `Token ${deepgramKey}` }
      });
      pipeline.deepgramWs = dgWs;
      dgWs.on('open', () => {
        console.log('[Telephony STT] Deepgram STT WebSocket connection opened successfully.');
        resetTelephonySilenceTimer(sessionId, adapter);
        
        // Feed inbound audio directly after decoding & resampling in JS (replaces FFmpeg process spawning to eliminate real-time piping latency)
        adapter.on('audio', (rawMulawAudio: Buffer) => {
          if (!pipeline.ended && dgWs.readyState === WebSocket.OPEN) {
            try {
              const pcm8kHz = decodeMuLawToPcm(rawMulawAudio);
              const pcm16kHz = resamplePcm8kHzTo16kHz(pcm8kHz);
              dgWs.send(pcm16kHz);
            } catch (err) {
              console.error('[Telephony STT Inbound Error] Failed to decode/resample/send audio:', err);
            }
          }
        });
      });

      // Handle Deepgram messages
      dgWs.on('message', async (messageData: WebSocket.Data) => {
        try {
          const response = JSON.parse(messageData.toString());
          const alternatives = response.channel?.alternatives?.[0];
          const transcript = alternatives?.transcript || '';

          if (transcript.trim()) {
            await setNudgeCount(sessionId, 0);
            clearTelephonySilenceTimer(sessionId);

            // Barge-in check
            const state = await getSessionState(sessionId);
            if (state === 'speaking') {
              await handleTelephonyBargeIn(sessionId, adapter);
            }
          }

          if (response.is_final) {
            if (transcript.trim()) {
              console.log(`[Telephony STT Final]: ${transcript}`);
              const currentSpeech = await getSessionSpeech(sessionId);
              const updatedSpeech = (currentSpeech + ' ' + transcript.trim()).trim();
              await setSessionSpeech(sessionId, updatedSpeech);
            }
          }

          if (response.type === 'UtteranceEnd') {
            console.log('[Telephony STT UtteranceEnd] Speech pause completed.');
            const fullSpeech = await getSessionSpeech(sessionId);

            if (isTrivialUtterance(fullSpeech)) {
              console.log(`[Telephony Speech Guard] Ignoring trivial utterance: "${fullSpeech}".`);
              resetTelephonySilenceTimer(sessionId, adapter);
            } else {
              console.log(`[Telephony Speech Guard] Triggering LLM turn for: "${fullSpeech}"`);
              
              // Persist combined final transcript
              try {
                await prisma.message.create({
                  data: { sessionId, role: 'user', content: fullSpeech }
                });
                await appendSessionHistory(sessionId, { role: 'user', content: fullSpeech });
              } catch (dbErr) {
                console.error('[Database Log Error] Failed to log user message:', dbErr);
              }

              await deleteSessionSpeech(sessionId);
              triggerTelephonyLlmTurn(sessionId, adapter, session, session.agentConfigVersion, openAiKey, deepgramKey);
            }
          }
        } catch (parseErr) {
          console.error('[Telephony STT Parsing Error]', parseErr);
        }
      });

      dgWs.on('error', (err) => {
        console.error('[Telephony STT Error]', err);
      });

      dgWs.on('close', () => {
        console.log('[Telephony STT] Deepgram connection closed.');
      });

      // Trigger initial greeting turn so the agent introduces itself first
      console.log(`[Telephony Init Turn] Triggering initial LLM greeting turn...`);
      triggerTelephonyLlmTurn(sessionId, adapter, session, session.agentConfigVersion, openAiKey, deepgramKey);

    } catch (err: any) {
      console.error('[Telephony Session Boot Error]', err);
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'telephony_boot',
            errorType: 'boot_error',
            message: err?.message || 'Unknown boot error',
            stack: err?.stack || ''
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log boot error:', dbErr));
      adapter.close();
    }
  });

  adapter.on('close', () => {
    if (pipeline.ended) return;
    pipeline.ended = true;
    
    console.log(`[Telephony Cleanup] Cleaning up session pipeline for ${sessionId}`);
    clearTelephonySilenceTimer(sessionId);
    cancelActiveTurn(sessionId);

    if (pipeline.ffmpegProcess) {
      try {
        pipeline.ffmpegProcess.kill();
      } catch (err) {}
    }

    if (pipeline.deepgramWs && pipeline.deepgramWs.readyState === WebSocket.OPEN) {
      try {
        pipeline.deepgramWs.close();
      } catch (err) {}
    }

    telephonyPipelines.delete(sessionId);
    prisma.session.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), status: 'completed' }
    }).catch(dbErr => console.error('[Database Log Error] Failed to finalize session status:', dbErr));
  });
}

async function triggerTelephonyLlmTurn(
  sessionId: string,
  adapter: TelephonyAdapter,
  session: any,
  agentConfig: any,
  openAiKey: string,
  deepgramKey: string,
  isSilenceNudge = false
) {
  const currentState = await getSessionState(sessionId);
  if (currentState !== 'listening' && !isSilenceNudge) {
    console.log(`[Telephony triggerLlmTurn] Session ${sessionId} in state "${currentState}". Aborting.`);
    return;
  }

  await setSessionState(sessionId, 'thinking');
  clearTelephonySilenceTimer(sessionId);

  try {
    let systemPrompt = agentConfig.systemPrompt;
    const hasContext =
      agentConfig.jobDescription ||
      agentConfig.candidateResume ||
      agentConfig.interviewPreferences ||
      agentConfig.interviewDurationMinutes ||
      agentConfig.uploadedQuestions;

    if (hasContext) {
      let contextBlock = '\n\n--- CONTEXT ---\n';
      if (agentConfig.jobDescription) contextBlock += `Job Description: ${agentConfig.jobDescription}\n`;
      if (agentConfig.candidateResume) contextBlock += `Candidate Resume: ${agentConfig.candidateResume}\n`;
      if (agentConfig.interviewPreferences) {
        const prefs = typeof agentConfig.interviewPreferences === 'string'
          ? agentConfig.interviewPreferences
          : JSON.stringify(agentConfig.interviewPreferences);
        contextBlock += `Interview Preferences: ${prefs}\n`;
      }
      if (agentConfig.interviewDurationMinutes) contextBlock += `Interview Duration: ${agentConfig.interviewDurationMinutes} minutes\n`;
      if (agentConfig.uploadedQuestions) {
        const questions = typeof agentConfig.uploadedQuestions === 'string'
          ? agentConfig.uploadedQuestions
          : JSON.stringify(agentConfig.uploadedQuestions);
        contextBlock += `Predefined Questions: ${questions}\n`;
      }
      contextBlock += '---\n\nUse the above context only where relevant to the instructions above.';
      systemPrompt += contextBlock;
    }

    const messages = await getSessionHistory(sessionId);
    cancelActiveTurn(sessionId);
    activeTurnLatencies.set(sessionId, { turnStartTime: Date.now() });

    const abortController = new AbortController();
    const voicePreference = agentConfig.voicePreference || 'aura-asteria-en';
    
    const ttsWorker = new TtsTelephonyWorker(sessionId, voicePreference, deepgramKey, adapter, async (totalChunks) => {
      console.log(`[Telephony] Finished speaking turn. Total chunks played: ${totalChunks}`);
      activeSessions.delete(sessionId);
      await setSessionState(sessionId, 'listening');
      resetTelephonySilenceTimer(sessionId, adapter);
    });

    activeSessions.set(sessionId, { abortController, ttsWorker });

    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ];

    if (isSilenceNudge) {
      openAiMessages.push({
        role: 'system',
        content: '[System Reminder: The user has been silent for 15 seconds. Output a brief nudge (one or two sentences) in your persona to check in on them and prompt them to continue the conversation.]'
      });
    }

    console.log(`[Telephony LLM] Calling OpenAI stream for ${sessionId}. History length: ${openAiMessages.length}.`);
    const llmStartTime = Date.now();
    const currentLatencies = activeTurnLatencies.get(sessionId);
    if (currentLatencies) {
      (currentLatencies as any).llmStartTime = llmStartTime;
    }

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
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenAI response stream not supported.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let sentenceBuffer = '';
    let fullResponse = '';

    await setSessionState(sessionId, 'speaking');

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

            // Log tokens usage if final token
            if (parsed.usage) {
              const { prompt_tokens, completion_tokens, total_tokens } = parsed.usage;
              prisma.sessionEvent.create({
                data: {
                  sessionId,
                  eventType: 'token_usage',
                  metadata: { promptTokens: prompt_tokens, completionTokens: completion_tokens, totalTokens: total_tokens }
                }
              }).catch(() => {});
            }

            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              const latencies = activeTurnLatencies.get(sessionId);
              if (latencies && !latencies.firstTokenTime) {
                latencies.firstTokenTime = Date.now();
              }

              fullResponse += content;
              sentenceBuffer += content;

              // Extract complete sentences on punctuation boundary
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
          } catch (e) {}
        }
      }
    }

    if (sentenceBuffer.trim()) {
      ttsWorker.push(sentenceBuffer.trim());
    }
    ttsWorker.markStreamFinished();

    const llmDuration = Date.now() - llmStartTime;
    const latenciesObj = activeTurnLatencies.get(sessionId);
    if (latenciesObj) {
      (latenciesObj as any).llmDurationMs = llmDuration;
    }

    // Save assistant response
    await prisma.message.create({
      data: { sessionId, role: 'assistant', content: fullResponse }
    });
    await appendSessionHistory(sessionId, { role: 'assistant', content: fullResponse });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`[Telephony LLM Aborted] OpenAI request aborted for session: ${sessionId}`);
    } else {
      console.error('[Telephony LLM Error]', error);
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'openai_llm',
            errorType: 'llm_error',
            message: error?.message || 'OpenAI LLM turn failed',
            stack: error?.stack || ''
          }
        }
      }).catch(dbErr => console.error('[Database Log Error] Failed to log LLM error:', dbErr));
      await setSessionState(sessionId, 'listening');
      resetTelephonySilenceTimer(sessionId, adapter);
    }
  }
}
