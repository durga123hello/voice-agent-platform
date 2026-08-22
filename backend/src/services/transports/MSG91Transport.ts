import WebSocket from 'ws';
import prisma from '../../db/client';
import { activeCallSessions } from '../../routes/calls';
import { pcm16ToMuLawBuffer, muLawToPcm16Buffer } from '../../utils/audioNormalizer';
import { BaseTransport } from './types';

export class MSG91Transport extends BaseTransport {
  public readonly type = 'msg91';
  public readonly sessionId: string;
  private phoneNumber: string | null;
  
  // Media WebSocket connection from SIP/WebRTC gateway
  private mediaWs: WebSocket | null = null;
  private callUuid: string | null = null;

  // Track the origin of call termination
  private disconnectInitiatedByVop = false;
  private abnormalDisconnectDetected = false;

  constructor(sessionId: string, phoneNumber: string | null = null) {
    super();
    this.sessionId = sessionId;
    this.phoneNumber = phoneNumber;
  }

  /**
   * Returns the stored provider call request ID.
   */
  public getCallUuid(): string | null {
    return this.callUuid;
  }

  /**
   * Resolves the correct CallState terminal status.
   */
  public getDisconnectReason(): 'ai_hangup' | 'user_hangup' | 'unexpected_disconnect' {
    if (this.abnormalDisconnectDetected) {
      return 'unexpected_disconnect';
    }
    if (this.disconnectInitiatedByVop) {
      return 'ai_hangup';
    }
    return 'user_hangup';
  }

  public async connect(): Promise<void> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const callerId = process.env.MSG91_CALLER_ID || '917314700077';
    const templateId = process.env.MSG91_TEMPLATE_ID || process.env.MSG91_FLOW_ID;

    console.log(`\n================================================================================`);
    console.log(`[MSG91Transport] Initiating MSG91 Voice Call for session: ${this.sessionId}`);
    console.log(`[MSG91Transport] Target Phone Number: ${this.phoneNumber}`);
    console.log(`[MSG91Transport] Caller ID: ${callerId}`);
    console.log(`[MSG91Transport] Auth Key: ${authKey ? 'Present' : 'Missing'}`);
    console.log(`[MSG91Transport] Template/Flow ID: ${templateId || 'Not Configured'}`);
    console.log(`--------------------------------------------------------------------------------`);

    if (!authKey) {
      console.warn(`[MSG91 ERROR] MSG91_AUTH_KEY is not defined in the environment.`);
      throw new Error('MSG91_AUTH_KEY is missing in environment configuration.');
    }

    if (!this.phoneNumber) {
      console.warn(`[MSG91 ERROR] Destination phone number is missing.`);
      throw new Error('Destination phone number is required.');
    }

    const cleanPhone = this.phoneNumber.replace(/[+\s-]/g, '');

    try {
      let url: string;
      let body: any;

      if (templateId) {
        url = 'https://control.msg91.com/api/v5/voice/call/';
        body = {
          template: templateId,
          caller_id: callerId,
          client_number: cleanPhone
        };
      } else {
        url = 'https://control.msg91.com/api/v5/voice/call/ctc';
        body = {
          caller_id: callerId,
          destination: cleanPhone,
          destinationB: [cleanPhone]
        };
      }

      console.log(`[MSG91Transport] Dispatching HTTP POST to ${url}...`);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authkey': authKey
        },
        body: JSON.stringify(body)
      });

      const resText = await res.text();
      console.log(`[MSG91 API Response] Status: ${res.status}, Body: ${resText}`);

      if (res.ok) {
        let uuid = '';
        try {
          const parsed = JSON.parse(resText);
          uuid = parsed.uuid || parsed.request_id || '';
        } catch (e) {
          const match = resText.match(/"uuid"\s*:\s*"([^"]+)"/) || resText.match(/"request_id"\s*:\s*"([^"]+)"/);
          if (match) uuid = match[1];
        }

        if (uuid) {
          this.callUuid = uuid;
          console.log(`[MSG91Transport] Call initiated successfully. MSG91 UUID: ${uuid}`);

          // Register in database and fast memory lookup
          await prisma.sessionEvent.create({
            data: {
              sessionId: this.sessionId,
              eventType: 'msg91_call_initiated',
              metadata: { callId: uuid, timestamp: new Date().toISOString() }
            }
          });
          activeCallSessions.set(uuid, this.sessionId);
        } else {
          throw new Error(`Failed to parse call UUID from response body: ${resText}`);
        }
      } else {
        throw new Error(`MSG91 Gateway returned status ${res.status}: ${resText}`);
      }
    } catch (err: any) {
      console.error(`[MSG91Transport HTTP Exception]`, err);
      throw err;
    }

    console.log(`================================================================================\n`);
  }

  /**
   * Bind the WebSocket media stream connection initiated by MSG91/SIP trunk.
   */
  public handleMediaStream(ws: WebSocket): void {
    console.log(`[MSG91Transport] Binding WebSocket media stream for session ${this.sessionId}`);
    this.mediaWs = ws;

    ws.on('message', (messageData: WebSocket.Data) => {
      // 1. Wrap message processing in try-catch to prevent malformed data from crashing node
      try {
        const messageStr = messageData.toString();
        
        // Basic check for empty/nonsense payload
        if (!messageStr.trim()) return;

        const data = JSON.parse(messageStr);

        if (data.event === 'media' && data.media?.payload) {
          const payload = data.media.payload;
          
          // Verify valid base64 payload
          if (!/^[A-Za-z0-9+/=]+$/.test(payload.trim())) {
            console.warn(`[MSG91Transport] Received malformed base64 audio payload. Ignoring packet.`);
            return;
          }

          const mulawBuffer = Buffer.from(payload, 'base64');
          if (mulawBuffer.length === 0) return;
          
          // Normalize audio: PCMU 8kHz Mono -> PCM 16kHz Mono
          const pcmBuffer = muLawToPcm16Buffer(mulawBuffer);

          // Emit normalized PCM chunks to the Voice Engine
          this.emit('audio', pcmBuffer);
        } else if (data.event === 'stop') {
          console.log(`[MSG91Transport] Received call stop signal over WebSocket stream.`);
          this.emit('control', 'close', null);
        }
      } catch (e: any) {
        console.warn(`[MSG91Transport] Error decoding media message: ${e.message || e}`);
        
        // Fallback: If it's a raw binary mu-law stream rather than JSON
        if (Buffer.isBuffer(messageData)) {
          try {
            const pcmBuffer = muLawToPcm16Buffer(messageData);
            this.emit('audio', pcmBuffer);
          } catch (binaryErr: any) {
            console.warn(`[MSG91Transport] Error converting raw binary audio buffer: ${binaryErr.message || binaryErr}`);
          }
        }
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[MSG91Transport Stream Close] Session: ${this.sessionId}, Code: ${code}, Reason: ${reason}`);
      
      // If code indicates abnormal termination (not 1000/1005) and VOP did not trigger disconnect
      if (code !== 1000 && code !== 1005 && !this.disconnectInitiatedByVop) {
        this.abnormalDisconnectDetected = true;
        this.emit('control', 'unexpected_disconnect', { code, reason });
      } else {
        this.emit('control', 'close', null);
      }
    });

    ws.on('error', (err) => {
      console.error(`[MSG91Transport Stream Error] Session: ${this.sessionId}`, err);
      if (!this.disconnectInitiatedByVop) {
        this.abnormalDisconnectDetected = true;
        this.emit('control', 'unexpected_disconnect', { error: err.message || err });
      }
    });
  }

  public async disconnect(): Promise<void> {
    console.log(`[MSG91Transport Disconnect] Cleaning up transport for session ${this.sessionId}`);
    
    // Set VOP disconnect flag to prevent race conditions on close event
    this.disconnectInitiatedByVop = true;

    if (this.mediaWs) {
      try {
        this.mediaWs.close();
      } catch (e) {}
      this.mediaWs = null;
    }

    if (this.callUuid) {
      activeCallSessions.delete(this.callUuid);
    }
  }

  /**
   * Send synthesized voice engine PCM chunk back to telephony WebSocket.
   */
  public async sendAudioChunk(chunk: Buffer, chunkIndex: number): Promise<void> {
    if (this.mediaWs && this.mediaWs.readyState === WebSocket.OPEN) {
      try {
        // Normalize audio: PCM 16kHz Mono -> PCMU 8kHz Mono
        const mulawBuffer = pcm16ToMuLawBuffer(chunk);

        // Pack as standard JSON media wrapper
        const payload = JSON.stringify({
          event: 'media',
          media: {
            payload: mulawBuffer.toString('base64')
          }
        });

        this.mediaWs.send(payload);
      } catch (err: any) {
        console.error(`[MSG91Transport] Failed to send audio chunk ${chunkIndex}:`, err.message || err);
      }
    }
  }

  public async sendTtsDone(totalChunks: number): Promise<void> {
    console.log(`[MSG91Transport] Speech playback complete. Total chunks played: ${totalChunks}`);
  }

  public sendTranscript(text: string, isFinal: boolean): void {
    console.log(`[MSG91Transport] Transcript: "${text}" (isFinal: ${isFinal})`);
  }

  public sendUtteranceEnd(): void {
    console.log('[MSG91Transport] UtteranceEnd event triggered.');
  }

  public sendLlmStart(): void {
    console.log('[MSG91Transport] LLM response generation started.');
  }

  public sendLlmChunk(text: string): void {
    // console.log(`[MSG91Transport] LLM token: "${text}"`);
  }

  public sendLlmDone(fullText: string): void {
    console.log(`[MSG91Transport] LLM response generation complete.`);
  }

  public sendError(message: string): void {
    console.error(`[MSG91Transport Error] ${message}`);
  }
}
