import { TelephonyAdapter } from './base';
import prisma from '../../db/client';
import { activeTurnLatencies } from '../signaling';

export async function getDeepgramTtsMulaw(
  sessionId: string,
  text: string,
  voice: string,
  apiKey: string
): Promise<Buffer> {
  try {
    const ttsReqStart = Date.now();
    // Fetch raw mulaw audio (8kHz, single channel) directly from Deepgram
    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voice}&container=none&encoding=mulaw&sample_rate=8000`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'audio/mulaw'
        },
        body: JSON.stringify({ text })
      }
    );
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
      const msg = `Deepgram TTS Mulaw API error: ${status} - ${errText}`;

      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'deepgram_tts_telephony',
            errorType,
            message: msg
          }
        }
      }).catch((dbErr) => console.error('[Database Log Error] Failed to log provider error event:', dbErr));

      throw new Error(msg);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error('[Deepgram TTS Mulaw Error]', error);
    if (!error.message.includes('Deepgram TTS Mulaw API error:')) {
      prisma.sessionEvent.create({
        data: {
          sessionId,
          eventType: 'provider_error',
          metadata: {
            provider: 'deepgram_tts_telephony',
            errorType: 'fetch_error',
            message: error?.message || 'Network/connection error'
          }
        }
      }).catch((dbErr) => console.error('[Database Log Error] Failed to log provider error event:', dbErr));
    }
    throw error;
  }
}

export class TtsTelephonyWorker {
  private queue: string[] = [];
  private active = false;
  private cancelled = false;
  private streamFinished = false;
  private chunkCount = 0;

  constructor(
    private sessionId: string,
    private voice: string,
    private apiKey: string,
    private adapter: TelephonyAdapter,
    private onFinished: (totalChunks: number) => void
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
        console.log(`[TTS Telephony Worker] Queue empty and stream finished. Total chunks: ${this.chunkCount}`);
        this.onFinished(this.chunkCount);
      }
      return;
    }

    this.active = true;
    const sentence = this.queue.shift()!;
    try {
      console.log(`[TTS Telephony Worker] Generating TTS for: "${sentence}" using voice ${this.voice}`);
      const ttsChunkStart = Date.now();
      const audioBuffer = await getDeepgramTtsMulaw(this.sessionId, sentence, this.voice, this.apiKey);
      const ttsChunkDuration = Date.now() - ttsChunkStart;

      // Record latency checkpoint
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
        this.chunkCount++;
        const base64Audio = audioBuffer.toString('base64');
        console.log(`[TTS Telephony Worker] Audio chunk generated (${audioBuffer.length} bytes). Sending chunk ${this.chunkCount} to telephony adapter.`);
        
        const relayStart = Date.now();
        await this.adapter.playAudio(base64Audio);
        const relayMs = Date.now() - relayStart;

        if (latencies) {
          if (!(latencies as any).ttsRelayDurations) {
            (latencies as any).ttsRelayDurations = [];
          }
          (latencies as any).ttsRelayDurations.push(relayMs);
        }
      }
    } catch (err) {
      console.error('[TTS Telephony Worker Error] TTS generation failed:', err);
    } finally {
      this.active = false;
      this.processNext();
    }
  }
}
