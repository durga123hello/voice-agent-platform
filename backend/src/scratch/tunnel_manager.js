const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');

function updateEnvFile(newUrl) {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (err) {
    console.error('Failed to read .env file:', err);
    return false;
  }

  const regex = /PLIVO_ANSWER_URL_BASE="[^"]*"/g;
  if (content.match(regex)) {
    content = content.replace(regex, `PLIVO_ANSWER_URL_BASE="${newUrl}"`);
  } else {
    content += `\nPLIVO_ANSWER_URL_BASE="${newUrl}"\n`;
  }

  try {
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`[Tunnel Manager] Successfully updated .env with URL: ${newUrl}`);
    return true;
  } catch (err) {
    console.error('Failed to write .env file:', err);
    return false;
  }
}

let backendProcess = null;

function startBackend() {
  if (backendProcess) {
    console.log('[Tunnel Manager] Restarting backend server...');
    try {
      backendProcess.kill('SIGINT');
    } catch (e) {}
  } else {
    console.log('[Tunnel Manager] Starting backend server...');
  }

  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname, '../../'),
    shell: true,
    stdio: 'inherit'
  });

  backendProcess.on('error', (err) => {
    console.error('[Tunnel Manager] Backend process error:', err);
  });
}

function startTunnel() {
  console.log('[Tunnel Manager] Starting localhost.run SSH tunnel...');
  
  const tunnel = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-R', '80:localhost:3000',
    'nokey@localhost.run'
  ], {
    shell: true
  });

  let buffer = '';

  tunnel.stdout.on('data', (data) => {
    const chunk = data.toString();
    process.stdout.write(chunk); // Print tunnel output to console
    buffer += chunk;

    // Scan buffer for localhost.run URL
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete last line in buffer

    for (const line of lines) {
      const match = line.match(/(https:\/\/[a-z0-9]+\.lhr\.life)/i);
      if (match) {
        const url = match[1];
        console.log(`[Tunnel Manager] Found active tunnel URL: ${url}`);
        
        // Read current URL from .env to see if it changed
        let currentUrl = '';
        try {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const envMatch = envContent.match(/PLIVO_ANSWER_URL_BASE="([^"]*)"/);
          if (envMatch) {
            currentUrl = envMatch[1];
          }
        } catch (err) {}

        if (url !== currentUrl) {
          console.log(`[Tunnel Manager] Tunnel URL changed from "${currentUrl}" to "${url}"`);
          const updated = updateEnvFile(url);
          if (updated) {
            startBackend();
          }
        } else {
          console.log('[Tunnel Manager] Tunnel URL is already in sync with .env');
          if (!backendProcess) {
            startBackend();
          }
        }
      }
    }
  });

  tunnel.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  tunnel.on('close', (code) => {
    console.log(`[Tunnel Manager] Tunnel process exited with code ${code}. Restarting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });
}

process.on('SIGINT', () => {
  console.log('[Tunnel Manager] Cleaning up processes...');
  if (backendProcess) {
    try {
      backendProcess.kill('SIGINT');
    } catch (e) {}
  }
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('[Tunnel Manager] Cleaning up processes...');
  if (backendProcess) {
    try {
      backendProcess.kill('SIGINT');
    } catch (e) {}
  }
  process.exit();
});

startTunnel();
