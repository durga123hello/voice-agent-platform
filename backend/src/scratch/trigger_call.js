const http = require('http');

const data = JSON.stringify({
  agentConfigId: "d6b8d33c-9a0c-4f06-8648-840de9809397",
  phoneNumber: "+917892728578",
  recordingEnabled: true
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sessions/outbound',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Body: ${body}`);
  });
});

req.on('error', (error) => {
  console.error('Error triggering call:', error);
});

req.write(data);
req.end();
