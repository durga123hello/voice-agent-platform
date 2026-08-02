const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING TWO-TIER API KEY SYSTEM VERIFICATION ===\n');

  // Helper to create tenant and retrieve a JWT session token
  async function createTenant(name, email) {
    const signupRes = await fetch(`${BACKEND_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'password123' })
    });
    if (!signupRes.ok) throw new Error(`Signup failed: ${await signupRes.text()}`);
    const signupData = await signupRes.json();

    const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: signupData.debugCode })
    });
    if (!verifyRes.ok) throw new Error(`OTP verify failed: ${await verifyRes.text()}`);

    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
    const loginData = await loginRes.json();
    return { token: loginData.token, tenantId: loginData.tenant.id };
  }

  // Helper to create API key via dashboard JWT session token
  async function createApiKey(token, label, type) {
    const res = await fetch(`${BACKEND_URL}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: label, type })
    });
    if (!res.ok) throw new Error(`Key creation failed: ${await res.text()}`);
    const data = await res.json();
    return data.rawKey;
  }

  // 1. Setup Tenant A
  console.log('1. Setting up Tenant A...');
  const tenantAEmail = `tenant-a-${Date.now()}@test.com`;
  const tenantA = await createTenant('Tenant A Corp', tenantAEmail);
  console.log(`Tenant A created. ID: ${tenantA.tenantId}`);

  // Generate private and public key for Tenant A
  const privateKeyA = await createApiKey(tenantA.token, 'Private Key A', 'private');
  const publicKeyA = await createApiKey(tenantA.token, 'Public Key A', 'public');
  console.log(`Private Key A: ${privateKeyA}`);
  console.log(`Public Key A: ${publicKeyA}\n`);

  // 2. Setup Tenant B
  console.log('2. Setting up Tenant B...');
  const tenantBEmail = `tenant-b-${Date.now()}@test.com`;
  const tenantB = await createTenant('Tenant B Corp', tenantBEmail);
  console.log(`Tenant B created. ID: ${tenantB.tenantId}`);

  // Generate private and public key for Tenant B
  const privateKeyB = await createApiKey(tenantB.token, 'Private Key B', 'private');
  console.log(`Private Key B: ${privateKeyB}\n`);

  // 3. Confirm Private Key A can call POST /api/v1/assistants
  console.log('3. Testing assistant creation with PRIVATE Key A...');
  const createAssistantPayload = {
    name: 'Test Voice Assistant',
    firstMessage: 'Hello, this is a test.',
    transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
    voice: { provider: 'deepgram', voiceId: 'aura-asteria-en', model: 'aura' },
    model: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'system', content: 'You are a friendly AI.' }] },
    recordingEnabled: true,
    silenceTimeoutSeconds: 15
  };

  const createAssistantRes = await fetch(`${BACKEND_URL}/api/v1/assistants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${privateKeyA}`
    },
    body: JSON.stringify(createAssistantPayload)
  });

  if (!createAssistantRes.ok) {
    throw new Error(`Private key failed to create assistant: ${await createAssistantRes.text()}`);
  }
  const assistantA = await createAssistantRes.json();
  console.log(`✅ Success! Assistant created by Private Key. Assistant ID: ${assistantA.id}\n`);

  // 4. Confirm Public Key A is REJECTED (403) when calling POST /api/v1/assistants
  console.log('4. Testing assistant creation with PUBLIC Key A (should be rejected with 403)...');
  const createAssistantPublicRes = await fetch(`${BACKEND_URL}/api/v1/assistants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKeyA}`
    },
    body: JSON.stringify(createAssistantPayload)
  });
  console.log(`Status code: ${createAssistantPublicRes.status} (Expected: 403)`);
  if (createAssistantPublicRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden when calling assistants endpoint with public key, got ${createAssistantPublicRes.status}`);
  }
  console.log('✅ Success! Public key write request blocked with 403 Forbidden.\n');

  // 5. Confirm Public Key A can successfully create a session against Tenant A's config
  console.log('5. Testing session creation with PUBLIC Key A against Tenant A config...');
  const createSessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKeyA}`
    },
    body: JSON.stringify({ agentConfigId: assistantA.id })
  });
  if (!createSessionRes.ok) {
    throw new Error(`Public key failed to create session: ${await createSessionRes.text()}`);
  }
  const sessionData = await createSessionRes.json();
  console.log(`✅ Success! Session created. ID: ${sessionData.id}\n`);

  // 6. Confirm Private Key A can also successfully create a session (superset)
  console.log('6. Testing session creation with PRIVATE Key A (superset capability)...');
  const createSessionPrivateRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${privateKeyA}`
    },
    body: JSON.stringify({ agentConfigId: assistantA.id })
  });
  if (!createSessionPrivateRes.ok) {
    throw new Error(`Private key failed to create session: ${await createSessionPrivateRes.text()}`);
  }
  console.log(`✅ Success! Private key allowed to create session.\n`);

  // 7. Create an agent config for Tenant B using Private Key B
  console.log('7. Creating agent config for Tenant B...');
  const createAssistantBRes = await fetch(`${BACKEND_URL}/api/v1/assistants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${privateKeyB}`
    },
    body: JSON.stringify(createAssistantPayload)
  });
  if (!createAssistantBRes.ok) {
    throw new Error(`Failed to create config for Tenant B: ${await createAssistantBRes.text()}`);
  }
  const assistantB = await createAssistantBRes.json();
  console.log(`Tenant B Assistant ID: ${assistantB.id}\n`);

  // 8. Confirm Tenant A's Public Key cannot start a session against Tenant B's agent config
  console.log('8. Testing cross-tenant session block: Tenant A Public Key attempting to start session against Tenant B config...');
  const crossTenantSessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKeyA}`
    },
    body: JSON.stringify({ agentConfigId: assistantB.id })
  });
  console.log(`Cross-tenant session creation status: ${crossTenantSessionRes.status} (Expected: 404)`);
  if (crossTenantSessionRes.status !== 404) {
    throw new Error(`Expected 404 Not Found when trying to start session with Tenant A key against Tenant B config, got ${crossTenantSessionRes.status}`);
  }
  console.log('✅ Success! Cross-tenant config access blocked successfully.\n');

  console.log('=== ALL TWO-TIER API KEY SECURITY VERIFICATIONS PASSED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
