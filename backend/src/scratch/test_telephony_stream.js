const WebSocket = require('ws');

const BACKEND_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

async function run() {
  console.log('=== STARTING TELEPHONY SIMULATION TEST ===\n');

  try {
    // 1. Authenticate to get access token
    console.log('Logging in as default user...');
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'default@voiceplatform.com',
        password: 'defaultpassword'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await loginRes.text()}`);
    }

    const { token } = await loginRes.json();
    console.log('Successfully logged in.');

    // 2. Fetch agent configurations
    console.log('Fetching agent configs...');
    const configRes = await fetch(`${BACKEND_URL}/api/agent-configs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!configRes.ok) {
      throw new Error(`Failed to fetch configs: ${await configRes.text()}`);
    }

    const configs = await configRes.json();
    if (configs.length === 0) {
      throw new Error('No agent configurations found. Please create one on the dashboard first.');
    }

    const config = configs[0];
    console.log(`Using agent config: "${config.name || 'Unnamed Agent'}" (${config.id})`);

    // 3. Create a session
    console.log('Creating session...');
    const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ agentConfigId: config.id })
    });

    if (!sessionRes.ok) {
      throw new Error(`Failed to create session: ${await sessionRes.text()}`);
    }

    const session = await sessionRes.json();
    const sessionId = session.id;
    console.log(`Session created successfully. ID: ${sessionId}`);

    // 4. Open telephony WebSocket connection (Plivo)
    const socketUrl = `${WS_URL}/ws/telephony/plivo/${sessionId}`;
    console.log(`Connecting to Telephony WebSocket: ${socketUrl}`);
    const ws = new WebSocket(socketUrl);

    let silenceInterval = null;
    let sequenceNumber = 1;

    ws.on('open', () => {
      console.log('Telephony WebSocket connected.');

      // Send Plivo start event
      const startEvent = {
        event: 'start',
        sequenceNumber: sequenceNumber++,
        start: {
          callId: 'call-' + Math.random().toString(36).substring(7),
          streamId: 'stream-' + Math.random().toString(36).substring(7),
          accountId: 'account-default',
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000
          }
        }
      };

      console.log('Sending start event to server:', JSON.stringify(startEvent, null, 2));
      ws.send(JSON.stringify(startEvent));

      // Simulate streaming mulaw silence chunks (20ms increments = 160 bytes of 0xFF)
      console.log('Starting inbound mulaw audio stream simulation (silence)...');
      silenceInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const silencePayload = Buffer.alloc(160, 0xFF).toString('base64');
          const mediaEvent = {
            event: 'media',
            sequenceNumber: sequenceNumber++,
            streamId: startEvent.start.streamId,
            media: {
              track: 'inbound',
              payload: silencePayload
            }
          };
          ws.send(JSON.stringify(mediaEvent));
        }
      }, 20);

      console.log('\n--> STREAMING SILENCE. Waiting 15s to trigger silence nudging... <--\n');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[WS Inbound Message Received] Event: "${message.event}"`);
        
        if (message.event === 'playAudio') {
          console.log(`   * playAudio payload length: ${message.media.payload.length} base64 chars`);
          console.log(`   * sampleRate: ${message.media.sampleRate}`);
          console.log(`   * contentType: ${message.media.contentType}`);
          console.log('   * (Simulating playout...)');
        } else if (message.event === 'clearAudio') {
          console.log('   * clearAudio received (Barge-in / Interruption signal)');
        }
      } catch (err) {
        console.error('Failed to parse incoming WS message:', err);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Telephony WebSocket closed. Code: ${code}, Reason: ${reason}`);
      if (silenceInterval) clearInterval(silenceInterval);
    });

    ws.on('error', (err) => {
      console.error('Telephony WebSocket error:', err);
      if (silenceInterval) clearInterval(silenceInterval);
    });

    // Let the test run for 25 seconds to observe silence nudging trigger
    setTimeout(() => {
      console.log('\nEnding simulation. Closing WebSocket...');
      if (silenceInterval) clearInterval(silenceInterval);
      ws.close();
      console.log('Test completed.');
      process.exit(0);
    }, 25000);

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

run();
