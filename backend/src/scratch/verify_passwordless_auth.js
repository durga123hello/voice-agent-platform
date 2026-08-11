const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('=== STARTING PASSWORDLESS OTP-ONLY AUTHENTICATION VERIFICATION ===\n');

  const name = 'Passwordless Corp';
  const email = `otp-org-${Math.floor(Math.random() * 100000)}@passwordless.com`;

  // 1. Signup organization without password
  console.log(`1. Signing up new organization "${name}" (Email: ${email}) without password...`);
  const signupRes = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });

  if (!signupRes.ok) {
    throw new Error(`Signup failed: ${await signupRes.text()}`);
  }
  const signupData = await signupRes.json();
  const signupOtp = signupData.debugCode;
  console.log(`Successfully signed up. Debug OTP Code received: ${signupOtp}\n`);

  // 2. Verify signup OTP and confirm direct login session token
  console.log('2. Verifying signup OTP code (expecting auto-login JWT response)...');
  const verifySignupRes = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: signupOtp })
  });

  if (!verifySignupRes.ok) {
    throw new Error(`Signup OTP verification failed: ${await verifySignupRes.text()}`);
  }
  const verifySignupData = await verifySignupRes.json();
  const sessionToken = verifySignupData.token;
  console.log(`Signup OTP verified! Session Token: ${sessionToken.substring(0, 15)}...`);
  console.log(`Resolved Tenant: ${verifySignupData.tenant.name} (ID: ${verifySignupData.tenant.id})\n`);

  if (!sessionToken) {
    throw new Error('Expected JWT session token in response to verify-otp for passwordless onboarding');
  }

  // 3. Request a login OTP for the email
  console.log(`3. Requesting login OTP code for ${email}...`);
  const requestLoginOtpRes = await fetch(`${BACKEND_URL}/api/auth/request-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  if (!requestLoginOtpRes.ok) {
    throw new Error(`Failed to request login OTP: ${await requestLoginOtpRes.text()}`);
  }
  const requestLoginOtpData = await requestLoginOtpRes.json();
  const loginOtp = requestLoginOtpData.debugCode;
  console.log(`Successfully requested login OTP. Debug OTP Code received: ${loginOtp}\n`);

  // 4. Verify login OTP and confirm JWT session token
  console.log('4. Verifying login OTP code...');
  const verifyLoginOtpRes = await fetch(`${BACKEND_URL}/api/auth/verify-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: loginOtp })
  });

  if (!verifyLoginOtpRes.ok) {
    throw new Error(`Login OTP verification failed: ${await verifyLoginOtpRes.text()}`);
  }
  const verifyLoginOtpData = await verifyLoginOtpRes.json();
  const loginToken = verifyLoginOtpData.token;
  console.log(`Login OTP verified! Session Token: ${loginToken.substring(0, 15)}...`);
  console.log(`Resolved Tenant: ${verifyLoginOtpData.tenant.name} (ID: ${verifyLoginOtpData.tenant.id})\n`);

  if (!loginToken) {
    throw new Error('Expected JWT session token in response to verify-login-otp');
  }

  // 5. Test Rate Limiting for requesting OTP codes
  // We already made:
  // - 1 request during signup
  // - 1 request during login request above
  // Let's create a fresh email to test rate limit of 3 requests per 10 minutes strictly.
  const rateLimitEmail = `ratelimit-${Math.floor(Math.random() * 100000)}@ratelimit.com`;
  console.log(`5. Testing rate limiting (max 3 OTP requests per 10 mins) on fresh email ${rateLimitEmail}...`);

  // Let's sign up first (Request 1)
  console.log('Sending Request 1 (Signup)...');
  const r1 = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'RateLimit Test', email: rateLimitEmail })
  });
  console.log(`Request 1 status: ${r1.status}`);

  // Let's verify OTP to activate the email first
  const r1Data = await r1.json();
  const verifyR1 = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: rateLimitEmail, code: r1Data.debugCode })
  });
  console.log(`Verified email. Status: ${verifyR1.status}`);

  // Request 2 (Login OTP Request)
  console.log('Sending Request 2 (Login OTP)...');
  const r2 = await fetch(`${BACKEND_URL}/api/auth/request-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: rateLimitEmail })
  });
  console.log(`Request 2 status: ${r2.status}`);

  // Request 3 (Login OTP Request)
  console.log('Sending Request 3 (Login OTP)...');
  const r3 = await fetch(`${BACKEND_URL}/api/auth/request-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: rateLimitEmail })
  });
  console.log(`Request 3 status: ${r3.status}`);

  // Request 4 (Login OTP Request - should hit rate limit!)
  console.log('Sending Request 4 (Login OTP - expecting 429)...');
  const r4 = await fetch(`${BACKEND_URL}/api/auth/request-login-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: rateLimitEmail })
  });
  console.log(`Request 4 status: ${r4.status} (Expected: 429)`);

  if (r4.status !== 429) {
    throw new Error(`Expected status code 429 Too Many Requests for Request 4, got ${r4.status}`);
  }
  const r4Data = await r4.json();
  console.log(`Rate limit error details: ${r4Data.error}`);
  console.log('✅ Success! OTP rate limits enforced correctly.\n');

  console.log('=== ALL PASSWORDLESS AUTHENTICATION VERIFICATIONS PASSED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
