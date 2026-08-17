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
        const message = JSON.parse(data.toString());
        
        switch (message.event) {
          case 'start': {
            const startData = message.start;
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
              const rawAudio = Buffer.from(message.media.payload, 'base64');
              this.emit('audio', rawAudio);
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
      } catch (err) {
        console.error('[Plivo Adapter Error] Failed to parse WebSocket message:', err);
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

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}
