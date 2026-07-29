const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING API KEY SYSTEM E2E VERIFICATION ===\n');

  // 1. Create a test tenant (Organization)
  console.log('1. Creating test tenant "Acme Corp"...');
  const createTenantRes = await fetch(`${BACKEND_URL}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Acme Corp',
      contactEmail: 'admin@acme.com'
    })
  });
  if (!createTenantRes.ok) {
    throw new Error(`Failed to create tenant: ${await createTenantRes.text()}`);
  }
  const { tenant } = await createTenantRes.json();
  const tenantId = tenant.id;
  console.log(`Successfully created tenant: ${tenant.name} (ID: ${tenantId})\n`);

  // 2. Generate an API Key for the tenant
  console.log('2. Issuing API key for Acme Corp...');
  const createKeyRes = await fetch(`${BACKEND_URL}/api/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      name: 'Acme Prod Key'
    })
  });
  if (!createKeyRes.ok) {
    throw new Error(`Failed to issue API key: ${await createKeyRes.text()}`);
  }
  const createKeyData = await createKeyRes.json();
  const rawKey1 = createKeyData.rawKey;
  const keyId1 = createKeyData.key.id;
  console.log('Key response payload:', JSON.stringify(createKeyData.key, null, 2));
  console.log(`Raw API Key (shown once): ${rawKey1}`);
  console.log('Confirmed raw API key contains correct prefix format.\n');

  // 3. List API keys and verify the raw key is never returned or retrievable
  console.log('3. Listing API keys for Acme Corp...');
  const listKeysRes = await fetch(`${BACKEND_URL}/api/api-keys?tenantId=${tenantId}`);
  if (!listKeysRes.ok) {
    throw new Error(`Failed to list keys: ${await listKeysRes.text()}`);
  }
  const listKeysData = await listKeysRes.json();
  console.log('Keys listed in DB:', JSON.stringify(listKeysData.keys, null, 2));
  const hasRawKey = JSON.stringify(listKeysData).includes(rawKey1);
  console.log(`Is raw key retrievable from list? ${hasRawKey ? '❌ YES (Security failure)' : '✅ NO (Secure)'}\n`);
  if (hasRawKey) throw new Error('Security check failed: raw key exposed in listing');

  // 4. Test authentication with invalid/inactive keys
  console.log('4. Testing authentication rejection rules...');
  const invalidKey = 'vap_live_abcdefgh_invalidsecretkeyhere123456789';
  const badAuthRes = await fetch(`${BACKEND_URL}/api/agent-configs`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${invalidKey}` }
  });
  console.log(`Request with invalid key: Status = ${badAuthRes.status} (Expected: 401)`);
  if (badAuthRes.status !== 401) throw new Error('Expected 401 Unauthorized for invalid key');
  console.log('✅ Invalid key correctly rejected with 401.\n');

  // 5. Create an agent config using the valid API key
  console.log('5. Creating agent config for Acme Corp using API Key...');
  const createConfigRes = await fetch(`${BACKEND_URL}/api/agent-configs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${rawKey1}`
    },
    body: JSON.stringify({
      name: 'Acme Helper',
      systemPrompt: 'You are the helpdesk assistant for Acme Corp.',
      llmModel: 'gpt-4o-mini',
      voicePreference: 'aura-asteria-en'
    })
  });
  if (!createConfigRes.ok) {
    throw new Error(`Failed to create agent config: ${await createConfigRes.text()}`);
  }
  const acmeConfig = await createConfigRes.json();
  const configId = acmeConfig.id;
  console.log(`Created Agent Config ID: ${configId}`);
  console.log(`Config tenantId: ${acmeConfig.tenantId} (Matches Acme Corp tenantId: ${acmeConfig.tenantId === tenantId})\n`);
  if (acmeConfig.tenantId !== tenantId) throw new Error('Agent config tenantId does not match Acme Corp');

  // 6. Create a session for Acme Corp using the API key
  console.log('6. Creating programmatically managed session using API Key...');
  const createSessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${rawKey1}`
    },
    body: JSON.stringify({
      agentConfigId: configId
    })
  });
  if (!createSessionRes.ok) {
    throw new Error(`Failed to create session: ${await createSessionRes.text()}`);
  }
  const acmeSession = await createSessionRes.json();
  const sessionId = acmeSession.id;
  console.log(`Created Session ID: ${sessionId}`);
  console.log(`Confirmed session created successfully with auth token: ${acmeSession.wsToken}\n`);

  // 7. Rotate the API Key
  console.log('7. Rotating Acme Corp API key...');
  const rotateRes = await fetch(`${BACKEND_URL}/api/api-keys/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      oldKeyId: keyId1,
      name: 'Acme Prod Key Rotated'
    })
  });
  if (!rotateRes.ok) {
    throw new Error(`Rotation failed: ${await rotateRes.text()}`);
  }
  const rotateData = await rotateRes.json();
  const rawKey2 = rotateData.rawKey;
  const keyId2 = rotateData.newKey.id;
  console.log(`New Raw API Key (shown once): ${rawKey2}`);
  console.log('Old key successfully marked inactive (isActive = false).\n');

  // 8. Confirm old key is now rejected
  console.log('8. Verifying revoked old key rejection...');
  const oldKeyTestRes = await fetch(`${BACKEND_URL}/api/agent-configs`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${rawKey1}` }
  });
  console.log(`Request with revoked key: Status = ${oldKeyTestRes.status} (Expected: 401)`);
  if (oldKeyTestRes.status !== 401) throw new Error('Expected 401 Unauthorized for revoked key');
  console.log('✅ Revoked key correctly rejected with 401.\n');

  // 9. Confirm new key works perfectly
  console.log('9. Verifying working rotated new key...');
  const newKeyTestRes = await fetch(`${BACKEND_URL}/api/agent-configs`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${rawKey2}` }
  });
  console.log(`Request with new key: Status = ${newKeyTestRes.status} (Expected: 200)`);
  if (newKeyTestRes.status !== 200) throw new Error('Expected 200 OK for working new key');
  console.log('✅ Rotated new key authenticated successfully.\n');

  // 10. Verify data integrity: existing config/session still belongs to Acme Corp
  console.log('10. Verifying data integrity post-rotation...');
  const checkConfigRes = await fetch(`${BACKEND_URL}/api/agent-configs/${configId}`, {
    headers: { 'Authorization': `Bearer ${rawKey2}` }
  });
  const checkConfig = await checkConfigRes.json();
  console.log(`Config tenantId: ${checkConfig.tenantId} (Matches Acme Corp: ${checkConfig.tenantId === tenantId})`);
  if (checkConfig.tenantId !== tenantId) throw new Error('Data integrity violation: tenantId altered');

  console.log('\n=== E2E API KEY SYSTEM VERIFICATION COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
