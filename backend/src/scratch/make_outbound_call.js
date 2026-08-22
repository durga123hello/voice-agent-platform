const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = 'http://localhost:3000';

async function run() {
  const targetNumber = process.argv[2];
  if (!targetNumber) {
    console.error('Error: Please provide the target phone number to call (e.g. node make_outbound_call.js +14155551234)');
    process.exit(1);
  }

  const {
    PLIVO_AUTH_ID,
    PLIVO_AUTH_TOKEN,
    PLIVO_FROM_NUMBER,
    PLIVO_ANSWER_URL_BASE
  } = process.env;

  if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN || !PLIVO_FROM_NUMBER || !PLIVO_ANSWER_URL_BASE) {
    console.error('Error: Please make sure PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_FROM_NUMBER, and PLIVO_ANSWER_URL_BASE are configured in backend/.env');
    process.exit(1);
  }

  console.log(`=== STARTING OUTBOUND TELEPHONY CALL TRACE ===`);
  console.log(`Target Number: ${targetNumber}`);
  console.log(`From Number:   ${PLIVO_FROM_NUMBER}`);
  console.log(`Answer URL Base: ${PLIVO_ANSWER_URL_BASE}`);

  try {
    // 1. Authenticate to get access token
    console.log('\nLogging in...');
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
    console.log('Logged in successfully.');

    // 2. Fetch agent configurations
    console.log('\nFetching agent configs...');
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
    console.log('\nCreating session...');
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
    console.log(`Session created. ID: ${sessionId}`);

    // 4. Trigger Outbound Call via Plivo API
    const answerUrl = `${PLIVO_ANSWER_URL_BASE}/api/telephony/plivo/answer/${sessionId}`;
    console.log(`\nTriggering Plivo outbound call to ${targetNumber}...`);
    console.log(`Answer URL: ${answerUrl}`);

    const plivoUrl = `https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Call/`;
    const authString = Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64');

    const plivoRes = await fetch(plivoUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: PLIVO_FROM_NUMBER,
        to: targetNumber,
        answer_url: answerUrl,
        answer_method: 'POST'
      })
    });

    const plivoResultText = await plivoRes.text();
    if (!plivoRes.ok) {
      throw new Error(`Plivo API Outbound Call trigger failed: ${plivoResultText}`);
    }

    console.log('Outbound call request successful!');
    console.log('Plivo Response:', JSON.parse(plivoResultText));
    console.log(`\n--> CALL IN PROGRESS. Answer your phone! <--`);
  } catch (error) {
    console.error('\nCall failed to trigger:', error.message || error);
  }
}

run();
