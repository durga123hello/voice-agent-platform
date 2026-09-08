const fs = require('fs');
const path = require('path');

const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR TRANSCRIPT/RESULTS RELAY LOGIC ---');
  lines.forEach((line, idx) => {
    if (
      line.includes('transcript') || 
      line.includes('interim') || 
      line.includes('Results') || 
      line.includes('clientWs.send') || 
      line.includes('ws.send')
    ) {
      if (line.includes('speech') || line.includes('channel') || line.includes('interim') || line.includes('type') || line.includes('text')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    }
  });
} else {
  console.log('File does not exist');
}
