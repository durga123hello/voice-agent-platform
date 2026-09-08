const fs = require('fs');
const path = require('path');

const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR AUDIO_CHUNK ---');
  lines.forEach((line, idx) => {
    if (line.includes('audio_chunk') || line.includes('audioChunk') || line.includes('tts_done')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
