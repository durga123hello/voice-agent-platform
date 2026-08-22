import WebSocket from 'ws';
import { TelephonyAdapter, CallMetadata } from './base';

export class PlivoAdapter extends TelephonyAdapter {
  private ws: WebSocket;
  private streamId: string | null = null;
  private callId: string | null = null;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
    this.setupListeners();
  }

  private setupListeners() {
    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        if (!data) {
          throw new Error('Received empty or null WebSocket message');
        }
        
        let message: any;
        try {
          message = JSON.parse(data.toString());
        } catch (jsonErr: any) {
          console.error('[Plivo Adapter Error] Malformed JSON packet ignored:', jsonErr.message);
          return;
        }
        
        if (!message || typeof message !== 'object') {
          console.error('[Plivo Adapter Error] Unexpected non-object packet structure:', message);
          return;
        }
        
        switch (message.event) {
          case 'start': {
            const startData = message.start;
            if (!startData || !startData.streamId || !startData.callId) {
              console.error('[Plivo Adapter Error] Malformed start event metadata:', startData);
              return;
            }
            this.streamId = startData.streamId;
            this.callId = startData.callId;
            
            const metadata: CallMetadata = {
              callId: startData.callId,
              streamId: startData.streamId,
              accountId: startData.accountId,
              ...message
            };
            
            console.log(`[Plivo Adapter] Stream started. Stream ID: ${this.streamId}, Call ID: ${this.callId}`);
            this.emit('start', metadata);
            break;
          }
          
          case 'media': {
            if (message.media && message.media.payload) {
              try {
                const payloadStr = message.media.payload;
                if (typeof payloadStr !== 'string') {
                  throw new Error('Payload is not a string');
                }
                const rawAudio = Buffer.from(payloadStr, 'base64');
                if (rawAudio.length === 0) {
                  throw new Error('Decoded base64 audio payload is empty');
                }
                this.emit('audio', rawAudio);
              } catch (mediaErr: any) {
                console.error(`[Plivo Adapter Error] Invalid base64/media data chunk:`, mediaErr.message);
              }
            } else {
              console.warn('[Plivo Adapter Warning] Media packet missing payload');
            }
            break;
          }
          
          case 'stop': {
            console.log(`[Plivo Adapter] Stream stopped.`);
            this.emit('close');
            break;
          }
          
          default:
            // Ignore other events
            break;
        }
      } catch (err: any) {
        console.error('[Plivo Adapter Error] Failed to process message:', err.message);
      }
    });

    this.ws.on('close', () => {
      console.log(`[Plivo Adapter] WebSocket connection closed.`);
      this.emit('close');
    });

    this.ws.on('error', (err) => {
      console.error('[Plivo Adapter Error] WebSocket error:', err);
      this.emit('error', err);
    });
  }

  async playAudio(base64Payload: string): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Plivo Adapter Warning] Attempted to playAudio on a closed socket.');
      return;
    }

    const payload = JSON.stringify({
      event: 'playAudio',
      media: {
        contentType: 'audio/x-mulaw',
        sampleRate: 8000,
        payload: base64Payload
      }
    });

    return new Promise<void>((resolve, reject) => {
      this.ws.send(payload, (err) => {
        if (err) {
          console.error('[Plivo Adapter Error] Failed to send playAudio event:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async clearAudio(): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = JSON.stringify({
      event: 'clearAudio'
    });

    return new Promise<void>((resolve, reject) => {
      this.ws.send(payload, (err) => {
        if (err) {
          console.error('[Plivo Adapter Error] Failed to send clearAudio event:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  updateSocket(newWs: WebSocket) {
    try {
      const oldWs = this.ws;
      oldWs.removeAllListeners();
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }
    } catch (err) {}
    this.ws = newWs;
    this.setupListeners();
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}
