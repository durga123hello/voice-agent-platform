import WebSocket from 'ws';
import { getRouter } from '../mediasoup';
import { findFreeUdpPort } from '../../utils/ports';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { BaseTransport } from './types';

// Module-level caches for Mediasoup instances
const mediasoupTransports = new Map<string, any>();
const mediasoupProducers = new Map<string, any>();

export class WebRTCTransport extends BaseTransport {
  public readonly type = 'webrtc';
  public readonly sessionId: string;
  private ws: WebSocket;

  // Mediasoup & FFmpeg references
  private ffmpegProcess: any = null;
  private consumer: any = null;
  private plainTransport: any = null;
  private sdpPath: string = '';
  private activeTransports = new Set<string>();
  private activeProducers = new Set<string>();

  constructor(ws: WebSocket, sessionId: string) {
    super();
    this.ws = ws;
    this.sessionId = sessionId;
  }

  public async connect(): Promise<void> {
    // Setup message handlers for WebRTC negotiation
    this.ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        const router = getRouter();

        switch (data.type) {
          case 'getRouterRtpCapabilities': {
            console.log(`[WebRTCTransport] Sending Router RTP capabilities for session ${this.sessionId}`);
            this.ws.send(JSON.stringify({
              type: 'routerRtpCapabilities',
              rtpCapabilities: router.rtpCapabilities
            }));
            break;
          }

          case 'createWebRtcTransport': {
            console.log(`[WebRTCTransport] Creating WebRtcTransport...`);
            const listenIp = process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1';
            const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
            const transport = await router.createWebRtcTransport({
              listenIps: [{ ip: listenIp, announcedIp: announcedIp }],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true
            });

            mediasoupTransports.set(transport.id, transport);
            this.activeTransports.add(transport.id);

            transport.on('icestatechange', (iceState) => {
              console.log(`[WebRTCTransport ICE State Change] ID: ${transport.id}, state: ${iceState}`);
            });

            transport.on('dtlsstatechange', (dtlsState) => {
              console.log(`[WebRTCTransport DTLS State Change] ID: ${transport.id}, state: ${dtlsState}`);
            });

            this.ws.send(JSON.stringify({
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
            console.log(`[WebRTCTransport] Connecting WebRtcTransport ${transportId}...`);
            const transport = mediasoupTransports.get(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            await transport.connect({ dtlsParameters });
            this.ws.send(JSON.stringify({ type: 'webRtcTransportConnected' }));
            break;
          }

          case 'produce': {
            const { transportId, kind, rtpParameters } = data;
            console.log(`[WebRTCTransport] Requesting production on WebRtcTransport ${transportId}...`);
            const transport = mediasoupTransports.get(transportId);
            if (!transport) throw new Error(`Transport ${transportId} not found`);

            const producer = await transport.produce({ kind, rtpParameters });
            mediasoupProducers.set(producer.id, producer);
            this.activeProducers.add(producer.id);

            this.ws.send(JSON.stringify({
              type: 'produced',
              id: producer.id
            }));

            // Start the FFmpeg/RTP audio streaming pipeline
            await this.startPipeline(producer);
            break;
          }

          // Relay control signals to the Voice Engine
          case 'webrtc_rtt':
          case 'chunk_played':
          case 'playback_error':
          case 'interrupt':
          case 'playback_complete': {
            this.emit('control', data.type, data);
            break;
          }
        }
      } catch (err: any) {
        console.error('[WebRTCTransport Message Error]', err);
        this.sendError(err?.message || 'Error processing transport message');
      }
    });

    this.ws.on('close', () => {
      console.log(`[WebRTCTransport Close] Session: ${this.sessionId}`);
      this.emit('control', 'close', null);
    });

    this.ws.on('error', (err) => {
      console.error(`[WebRTCTransport Error] Session: ${this.sessionId}`, err);
      this.emit('control', 'close', null);
    });
  }

  public async disconnect(): Promise<void> {
    console.log(`[WebRTCTransport Disconnect] Cleaning up WebRTC resources for session ${this.sessionId}`);

    // 1. Kill FFmpeg
    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.kill('SIGKILL');
      } catch (e) {}
      this.ffmpegProcess = null;
    }

    // 2. Clean SDP file
    if (this.sdpPath && fs.existsSync(this.sdpPath)) {
      try {
        fs.unlinkSync(this.sdpPath);
      } catch (e) {}
    }

    // 3. Close consumer
    if (this.consumer) {
      try {
        this.consumer.close();
      } catch (e) {}
      this.consumer = null;
    }

    // 4. Close plain transport
    if (this.plainTransport) {
      try {
        this.plainTransport.close();
      } catch (e) {}
      this.plainTransport = null;
    }

    // 5. Close Mediasoup producers and transports used in this session
    for (const prodId of this.activeProducers) {
      const p = mediasoupProducers.get(prodId);
      if (p) {
        try { p.close(); } catch (e) {}
        mediasoupProducers.delete(prodId);
      }
    }
    this.activeProducers.clear();

    for (const transId of this.activeTransports) {
      const t = mediasoupTransports.get(transId);
      if (t) {
        try { t.close(); } catch (e) {}
        mediasoupTransports.delete(transId);
      }
    }
    this.activeTransports.clear();

    // 6. Close WebSocket
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }

  private async startPipeline(producer: any) {
    this.sdpPath = path.join(os.tmpdir(), `session-${this.sessionId}-${Date.now()}.sdp`);
    try {
      const ffmpegPort = await findFreeUdpPort();
      const router = getRouter();

      this.plainTransport = await router.createPlainTransport({
        listenIp: '127.0.0.1',
        rtcpMux: true,
        comedia: false
      });

      await this.plainTransport.connect({
        ip: '127.0.0.1',
        port: ffmpegPort
      });

      this.consumer = await this.plainTransport.consume({
        producerId: producer.id,
        rtpCapabilities: router.rtpCapabilities
      });

      await this.consumer.resume();

      const payloadType = this.consumer.rtpParameters.codecs[0].payloadType;
      const sdpContent = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=Mediasoup RTP Stream
c=IN IP4 127.0.0.1
t=0 0
m=audio ${ffmpegPort} RTP/AVP ${payloadType}
a=rtpmap:${payloadType} opus/48000/2
a=rtcp-mux
`;
      fs.writeFileSync(this.sdpPath, sdpContent);

      if (!ffmpegPath) {
        throw new Error('FFmpeg static binary not found');
      }

      const ffmpegArgs = [
        '-protocol_whitelist', 'file,rtp,udp',
        '-i', this.sdpPath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ac', '1',
        '-ar', '16000',
        'pipe:1'
      ];

      this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      this.ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        // Emit transcoded raw PCM chunks to the Voice Engine
        this.emit('audio', chunk);
      });

      this.ffmpegProcess.stderr.on('data', (data: Buffer) => {
        // Silence spam logs if needed, or pipe to stdout for logging
        if (process.env.DEBUG_FFMPEG === 'true') {
          console.log(`[WebRTCTransport FFmpeg Stderr] ${data.toString().trim()}`);
        }
      });

      this.ffmpegProcess.on('close', (code: number) => {
        console.log(`[WebRTCTransport FFmpeg] Process closed with code ${code}`);
      });

    } catch (err) {
      console.error('[WebRTCTransport Pipeline Error]', err);
      this.sendError('Failed to initialize local transcode pipeline');
    }
  }

  // Implementation of BaseTransport abstract send/control interfaces
  public async sendAudioChunk(chunk: Buffer, chunkIndex: number): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio_chunk',
        audio: chunk.toString('base64'),
        chunkIndex
      }));
    }
  }

  public async sendTtsDone(totalChunks: number): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'tts_done',
        totalChunks
      }));
    }
  }

  public sendTranscript(text: string, isFinal: boolean): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'transcript',
        isFinal,
        text
      }));
    }
  }

  public sendUtteranceEnd(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'utteranceEnd' }));
    }
  }

  public sendLlmStart(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'llm_start' }));
    }
  }

  public sendLlmChunk(text: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'llm_chunk', text }));
    }
  }

  public sendLlmDone(fullText: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'llm_done', fullText }));
    }
  }

  public sendError(message: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'error', message }));
    }
  }
}
