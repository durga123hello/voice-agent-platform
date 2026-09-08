const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../frontend/src/app/test-voice/page.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR LATENCY DISPLAY IN TEST-VOICE ---');
  lines.forEach((line, idx) => {
    if (line.includes('ms') || line.includes('Ms') || line.includes('latency') || line.includes('Latency')) {
      if (line.includes('div') || line.includes('span') || line.includes('p') || line.includes('{')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    }
  });
} else {
  console.log('File does not exist');
}
