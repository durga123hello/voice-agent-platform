import { sessionPipelines } from '../services/signaling';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import prisma from '../db/client';

const PORT = 3000;
const MOCK_DEEPGRAM_PORT = 3004;

process.env.DEEPGRAM_MOCK_URL = `ws://localhost:${MOCK_DEEPGRAM_PORT}`;
process.env.PORT = String(PORT);

// We will start the real app in this process to share the sessionPipelines Map memory
import app from '../app';

async function run() {
  console.log('=== STARTING MULTI-TURN LATENCY SIMULATION ===\n');

  // Since index.ts is auto-imported and auto-starts the server on PORT, 
  // we do not need to call server.listen ourselves. We just wait 2 seconds for it to start.
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Start mock Deepgram WebSocket server
  let mockDeepgramSocket: WebSocket | null = null;
  const wss = new WebSocketServer({ port: MOCK_DEEPGRAM_PORT });
  wss.on('connection', (ws) => {
    console.log('Mock Deepgram: Backend connected.');
    mockDeepgramSocket = ws;
    
    ws.on('message', (msg) => {
      // Mock Deepgram receiving binary chunks from backend
      // We don't need to do anything
    });
  });

  console.log(`Mock Deepgram server started on port ${MOCK_DEEPGRAM_PORT}`);

  // 3. Find any existing agent config
  const config = await prisma.agentConfig.findFirst();
  if (!config) throw new Error('No agent configuration found in DB. Please run backend seed or setup a configuration first.');
  console.log(`Using existing agentConfigId: ${config.id} (projectId: ${config.projectId})`);

  // 4. Create a session using backend API
  const sessionRes = await fetch(`http://localhost:${PORT}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentConfigId: config.id })
  });
  if (!sessionRes.ok) throw new Error(`Failed to create session: ${await sessionRes.text()}`);
  const sessionData = (await sessionRes.json()) as any;
  const sessionId = sessionData.id;
  console.log(`Session created in DB. ID: ${sessionId}`);

  // 5. Connect WS client to signaling server
  const clientWs = new WebSocket(`ws://localhost:${PORT}/ws/sessions/${sessionId}`);
  
  await new Promise<void>((resolve) => {
    clientWs.on('open', () => {
      console.log('Client WebSocket connected to signaling.');
      resolve();
    });
  });

  // Perform Mediasoup client side mock handshake to trigger startSttPipeline
  clientWs.send(JSON.stringify({ type: 'getRouterRtpCapabilities' }));

  let mockInterval: NodeJS.Timeout | null = null;
  let activeTransportId = '';
  const turnsCount = 6;

  clientWs.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'routerRtpCapabilities') {
      clientWs.send(JSON.stringify({ type: 'createWebRtcTransport' }));
    }
    else if (msg.type === 'webRtcTransportCreated') {
      activeTransportId = msg.id;
      clientWs.send(JSON.stringify({
        type: 'connectWebRtcTransport',
        transportId: msg.id,
        dtlsParameters: {
          role: 'server',
          fingerprints: [{ algorithm: 'sha-256', value: '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF' }]
        }
      }));
    }
    else if (msg.type === 'webRtcTransportConnected') {
      // Send produce to trigger startSttPipeline on backend
      clientWs.send(JSON.stringify({
        type: 'produce',
        transportId: activeTransportId,
        kind: 'audio',
        rtpParameters: { codecs: [{ mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 }] }
      }));
    }
    else if (msg.type === 'produced') {
      console.log('Handshake completed. Mediasoup pipeline is active on backend.');
      
      // Let's retrieve the pipeline reference
      const pipeline = sessionPipelines.get(sessionId);
      if (!pipeline) throw new Error('Pipeline not found in sessionPipelines');

      // Override deepgramOpenTime to match our timeline
      (pipeline as any).deepgramOpenTime = Date.now();

      // Start simulating audio packets sent to backend (updates chunksLog and totalBytesSent)
      console.log('Starting simulated chunk transmission...');
      let totalBytes = 0;
      mockInterval = setInterval(() => {
        if (!sessionPipelines.has(sessionId)) return;
        totalBytes += 640; // 640 bytes = 20ms of 16kHz PCM
        pipeline.totalBytesSent = totalBytes;
        const streamTime = totalBytes / 32000;
        pipeline.chunksLog = pipeline.chunksLog || [];
        pipeline.chunksLog.push({ streamTime, sentTime: Date.now() });
      }, 20);

      // Run consecutive turns
      for (let turn = 1; turn <= turnsCount; turn++) {
        await runTurn(turn, pipeline);
      }

      // Cleanup
      console.log('\nEnding call and cleaning up...');
      if (mockInterval) clearInterval(mockInterval);
      clientWs.close();
      wss.close();
      
      // Print database latency reports
      const events = await prisma.sessionEvent.findMany({
        where: { sessionId, eventType: 'turn_latency' },
        orderBy: { createdAt: 'asc' }
      });
      console.log(`\n=== VERIFICATION RESULTS FROM DATABASE (Total Turns: ${events.length}) ===`);
      events.forEach((ev, idx) => {
        const meta = ev.metadata as any;
        console.log(`\nTurn ${idx + 1}:`);
        console.log(`- stt_network_and_compute_ms: ${meta.stt_network_and_compute_ms}ms`);
        console.log(`- local_pipeline_ms: ${meta.local_pipeline_ms}ms`);
        console.log(`- deepgram_network_rtt_ms: ${meta.deepgram_network_rtt_ms}ms`);
        console.log(`- deepgram_processing_ms: ${meta.deepgram_processing_ms}ms`);
        
        // Assertions
        const local = meta.local_pipeline_ms;
        const parent = meta.stt_network_and_compute_ms;
        const rtt = meta.deepgram_network_rtt_ms;
        const proc = meta.deepgram_processing_ms;

        if (local > parent) {
          console.error(`❌ FAILURE: local_pipeline_ms (${local}) is larger than stt_network_and_compute_ms (${parent})`);
        } else {
          console.log(`✅ PASS: local_pipeline_ms (${local}) is <= stt_network_and_compute_ms (${parent})`);
        }

        if (rtt === 0 && proc === 0 && local > 0) {
          console.error(`❌ FAILURE: deepgram_network_rtt_ms and deepgram_processing_ms are both 0`);
        } else {
          console.log(`✅ PASS: deepgram_network_rtt_ms (${rtt}) and deepgram_processing_ms (${proc}) are populated`);
        }
      });

      console.log('\n=== SIMULATION COMPLETED ===');
      process.exit(0);
    }
  });

  // Helper to run a single mock conversational turn
  async function runTurn(turn: number, pipeline: any) {
    console.log(`\n--- Simulating Turn ${turn} ---`);
    
    // Simulate user speaking for 2.5 seconds
    await new Promise(r => setTimeout(r, 2500));

    if (!mockDeepgramSocket) throw new Error('Mock Deepgram socket not connected yet');

    const streamTime = pipeline.totalBytesSent / 32000;
    
    // 1. Send SpeechStarted
    console.log(`[Turn ${turn}] Sending SpeechStarted at streamTime ${streamTime - 2}s`);
    mockDeepgramSocket.send(JSON.stringify({
      type: 'SpeechStarted',
      channel: [0, 1],
      timestamp: streamTime - 2
    }));

    await new Promise(r => setTimeout(r, 200));

    // 2. Send transcript Results (including responseEndTime & recvTime log)
    const responseEndTime = streamTime;
    pipeline.responsesLog = pipeline.responsesLog || [];
    pipeline.responsesLog.push({ responseEndTime, recvTime: Date.now() });

    console.log(`[Turn ${turn}] Sending transcript Results with last word ending at ${streamTime}s`);
    mockDeepgramSocket.send(JSON.stringify({
      type: 'Results',
      channel_index: [0, 1],
      duration: 2.0,
      start: streamTime - 2.0,
      is_final: true,
      speech_final: true,
      channel: {
        alternatives: [{
          transcript: `simulated speech turn number ${turn}`,
          confidence: 0.99,
          words: [{ word: 'simulated', start: streamTime - 2.0, end: streamTime }]
        }]
      }
    }));

    // Simulate Deepgram silence detection delay (1.3 seconds endpointing)
    await new Promise(r => setTimeout(r, 1300));

    // 3. Send UtteranceEnd to trigger timing calculation
    console.log(`[Turn ${turn}] Sending UtteranceEnd`);
    mockDeepgramSocket.send(JSON.stringify({
      type: 'UtteranceEnd'
    }));

    // Wait for backend to finish processing the turn, save db event, and play audio out
    await new Promise(r => setTimeout(r, 1000));
    
    // Simulate audio playback complete event to return backend state to listening
    clientWs.send(JSON.stringify({ type: 'playbackComplete' }));
    
    // Allow state to reset
    await new Promise(r => setTimeout(r, 500));
  }
}

run().catch(console.error);
