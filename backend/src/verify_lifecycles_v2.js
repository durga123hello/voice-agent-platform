const http = require('http');

const BACKEND_URL = 'http://localhost:3000';

function post(url, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(data || {});
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Tenant-Id': 'default'
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsedRes = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, body: parsedRes });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'X-Tenant-Id': 'default'
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsedRes = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, body: parsedRes });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- STARTING TELEPHONY LIFECYCLE END-TO-END VERIFICATION ---');

  // 1. Get agent configs
  console.log('1. Fetching agent configurations...');
  const configList = await get(`${BACKEND_URL}/api/agent-configs`);
  if (configList.status !== 200 || !configList.body.length) {
    throw new Error('Failed to fetch agent configurations or no configs exist.');
  }
  const agentConfigId = configList.body[0].id;
  console.log(`Using agentConfigId: ${agentConfigId}`);

  // 2. Validate phone number validation
  console.log('\n2. Testing invalid phone number validation...');
  const badOutbound = await post(`${BACKEND_URL}/api/sessions/outbound`, {
    agentConfigId,
    phoneNumber: 'bad-number-123'
  });
  console.log(`Response Status: ${badOutbound.status}`);
  console.log(`Response Body:`, badOutbound.body);
  if (badOutbound.status !== 400) {
    throw new Error('Expected 400 Bad Request for malformed phone number.');
  }

  // 3. Start valid outbound call
  console.log('\n3. Starting valid outbound call...');
  const outboundRes = await post(`${BACKEND_URL}/api/sessions/outbound`, {
    agentConfigId,
    phoneNumber: '+919876543210'
  });
  console.log(`Response Status: ${outboundRes.status}`);
  if (outboundRes.status !== 201) {
    throw new Error(`Outbound call creation failed: ${JSON.stringify(outboundRes.body)}`);
  }
  const sessionId = outboundRes.body.id;
  console.log(`Outbound call initiated! sessionId: ${sessionId}`);

  // 4. Verify initial database states
  console.log('\n4. Verifying initial Postgres states...');
  const stateInit = await get(`${BACKEND_URL}/api/sessions/${sessionId}`);
  console.log(`Initial CallState: ${stateInit.body.callState}`);
  console.log(`Initial MediaState: ${stateInit.body.mediaState}`);
  console.log(`Initial ConversationState: ${stateInit.body.conversationState}`);
  if (stateInit.body.callState !== 'ringing') {
    throw new Error(`Expected initial CallState to be 'ringing', got '${stateInit.body.callState}'`);
  }

  // 5. Trigger Plivo busy status webhook
  console.log('\n5. Triggering busy status update callback...');
  const busyWebhook = await post(`${BACKEND_URL}/api/telephony/plivo/status/${sessionId}`, {
    CallUUID: 'plivo-test-uuid-12345',
    CallStatus: 'busy',
    HangupCause: 'USER_BUSY'
  });
  console.log(`Webhook response status: ${busyWebhook.status}`);
  if (busyWebhook.status !== 200) {
    throw new Error('Expected status update webhook to succeed.');
  }

  // 6. Verify terminal state locking and error mapping
  console.log('\n6. Checking terminal state fields...');
  const stateBusy = await get(`${BACKEND_URL}/api/sessions/${sessionId}`);
  console.log(`Post-Webhook CallState: ${stateBusy.body.callState}`);
  console.log(`ErrorCode: ${stateBusy.body.errorCode}`);
  console.log(`ErrorMessage: ${stateBusy.body.errorMessage}`);
  console.log(`UserMessage: ${stateBusy.body.userMessage}`);
  console.log(`Session Status: ${stateBusy.body.status}`);

  if (stateBusy.body.callState !== 'busy') {
    throw new Error(`Expected CallState to transition to 'busy', got '${stateBusy.body.callState}'`);
  }
  if (stateBusy.body.errorCode !== 'CALL_BUSY') {
    throw new Error('Expected ErrorCode to be mapped to CALL_BUSY.');
  }
  if (stateBusy.body.status !== 'aborted') {
    throw new Error('Expected session status to lock to aborted.');
  }

  // 7. Verify out-of-order webhook protection (try transition back to connected)
  console.log('\n7. Testing webhook out-of-order protection...');
  const orderWebhook = await post(`${BACKEND_URL}/api/telephony/plivo/status/${sessionId}`, {
    CallUUID: 'plivo-test-uuid-12345',
    CallStatus: 'in-progress'
  });
  console.log(`Out-of-order Webhook response: ${orderWebhook.status}`);

  const stateFinal = await get(`${BACKEND_URL}/api/sessions/${sessionId}`);
  console.log(`Final CallState after out-of-order: ${stateFinal.body.callState}`);
  if (stateFinal.body.callState !== 'busy') {
    throw new Error('Out-of-order webhook overrode a locked terminal state! State protection failed.');
  }

  console.log('\n✔ ALL LIFECYCLE VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err.message);
  process.exit(1);
});
