const fs = require('fs');
const path = require('path');

const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR deepgramOpenTime ---');
  lines.forEach((line, idx) => {
    if (line.includes('deepgramOpenTime')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
