const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING SELF-SERVICE AUTH SYSTEM E2E VERIFICATION ===\n');

  const email = `org-${Math.floor(Math.random() * 100000)}@bigorg.com`;
  const name = 'Big Organization Corp';
  const password = 'securepassword123';

  // 1. Signup organization
  console.log(`1. Signing up new organization "${name}" (Email: ${email})...`);
  const signupRes = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  if (!signupRes.ok) {
    throw new Error(`Signup failed: ${await signupRes.text()}`);
  }
  const signupData = await signupRes.json();
  const debugCode = signupData.debugCode;
  console.log(`Successfully signed up. Debug OTP Code received: ${debugCode}\n`);

  // 2. Try to login before verification (should fail 403)
  console.log('2. Verifying unverified login block...');
  const preVerifyLoginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  console.log(`Pre-verification login status: ${preVerifyLoginRes.status} (Expected: 403)`);
  if (preVerifyLoginRes.status !== 403) {
    throw new Error('Expected 403 Forbidden for unverified email login');
  }
  console.log('✅ Unverified login blocked successfully.\n');

  // 3. Verify OTP
  console.log(`3. Verifying email using OTP code: ${debugCode}...`);
  const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: debugCode })
  });
  if (!verifyRes.ok) {
    throw new Error(`OTP verification failed: ${await verifyRes.text()}`);
  }
  console.log('✅ Email successfully verified.\n');

  // 4. Log in successfully
  console.log('4. Logging in to retrieve JWT session token...');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }
  const loginData = await loginRes.json();
  const sessionToken = loginData.token;
  const tenantId = loginData.tenant.id;
  console.log(`Login successful! Session Token: ${sessionToken.substring(0, 15)}...`);
  console.log(`Resolved Tenant ID: ${tenantId}\n`);

  // 5. Issue API Key 1 using session token
  console.log('5. Generating API Key 1 (Dev Key) via Session Token...');
  const key1Res = await fetch(`${BACKEND_URL}/api/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ name: 'Dev Key' })
  });
  if (!key1Res.ok) {
    throw new Error(`Failed to generate Key 1: ${await key1Res.text()}`);
  }
  const key1Data = await key1Res.json();
  const rawKey1 = key1Data.rawKey;
  console.log(`Generated Key 1 (prefix: ${key1Data.key.keyPrefix}) successfully.\n`);

  // 6. Issue API Key 2 using session token
  console.log('6. Generating API Key 2 (Prod Key) via Session Token...');
  const key2Res = await fetch(`${BACKEND_URL}/api/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ name: 'Prod Key' })
  });
  if (!key2Res.ok) {
    throw new Error(`Failed to generate Key 2: ${await key2Res.text()}`);
  }
  const key2Data = await key2Res.json();
  const rawKey2 = key2Data.rawKey;
  console.log(`Generated Key 2 (prefix: ${key2Data.key.keyPrefix}) successfully.\n`);

  // 7. Verify both keys independently authenticate and resolve to the exact same tenant_id
  console.log('7. Verifying both keys independently resolve to same tenant_id...');
  
  // Call GET /api/api-keys using Key 1
  const listWithKey1Res = await fetch(`${BACKEND_URL}/api/api-keys`, {
    headers: { 'Authorization': `Bearer ${rawKey1}` }
  });
  if (!listWithKey1Res.ok) {
    throw new Error(`Auth failure with Key 1: ${await listWithKey1Res.text()}`);
  }
  const listWithKey1Data = await listWithKey1Res.json();
  const key1Tenant = listWithKey1Data.keys[0].tenantId;

  // Call GET /api/api-keys using Key 2
  const listWithKey2Res = await fetch(`${BACKEND_URL}/api/api-keys`, {
    headers: { 'Authorization': `Bearer ${rawKey2}` }
  });
  if (!listWithKey2Res.ok) {
    throw new Error(`Auth failure with Key 2: ${await listWithKey2Res.text()}`);
  }
  const listWithKey2Data = await listWithKey2Res.json();
  const key2Tenant = listWithKey2Data.keys[0].tenantId;

  console.log(`Key 1 resolved tenantId: ${key1Tenant}`);
  console.log(`Key 2 resolved tenantId: ${key2Tenant}`);
  console.log(`Do they match? ${key1Tenant === key2Tenant ? '✅ YES' : '❌ NO'}`);
  
  if (key1Tenant !== tenantId || key2Tenant !== tenantId) {
    throw new Error('Tenant IDs resolved from API keys do not match the logged-in session tenant ID!');
  }

  console.log('\n=== E2E SELF-SERVICE AUTH VERIFICATION COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
