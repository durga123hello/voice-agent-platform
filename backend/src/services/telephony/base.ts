import { EventEmitter } from 'events';

export interface CallMetadata {
  callId: string;
  streamId: string;
  accountId: string;
  [key: string]: any;
}

export abstract class TelephonyAdapter extends EventEmitter {
  /**
   * Send synthesized audio payload back to the call channel.
   * @param base64Payload Base64 encoded audio matching the expected format (e.g. mulaw/8000).
   */
  abstract playAudio(base64Payload: string): Promise<void>;

  /**
   * Stop/interrupt any currently queued playback on the call channel.
   */
  abstract clearAudio(): Promise<void>;

  /**
   * Gracefully close the connection.
   */
  abstract close(): Promise<void>;
}
