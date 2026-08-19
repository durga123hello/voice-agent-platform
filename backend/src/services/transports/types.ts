import { EventEmitter } from 'events';

export abstract class BaseTransport extends EventEmitter {
  public abstract readonly type: 'webrtc' | 'msg91';
  public abstract readonly sessionId: string;

  // Initialize the transport channel and setup audio pipelines
  public abstract connect(): Promise<void>;

  // Disconnect the transport and cleanup resources
  public abstract disconnect(): Promise<void>;

  // Send synthesized TTS audio chunk to client
  public abstract sendAudioChunk(chunk: Buffer, chunkIndex: number): Promise<void>;

  // Send TTS complete signal
  public abstract sendTtsDone(totalChunks: number): Promise<void>;

  // Relay transcripts to user interface
  public abstract sendTranscript(text: string, isFinal: boolean): void;

  // Signal speech pause completion event
  public abstract sendUtteranceEnd(): void;

  // Signal LLM start, chunk and completion events
  public abstract sendLlmStart(): void;
  public abstract sendLlmChunk(text: string): void;
  public abstract sendLlmDone(fullText: string): void;

  // Send errors to client
  public abstract sendError(message: string): void;
}
