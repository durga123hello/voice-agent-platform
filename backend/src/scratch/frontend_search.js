const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/test-voice/page.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING frontend/src/app/test-voice/page.tsx ---');
  lines.forEach((line, idx) => {
    if (line.includes('ws.') || line.includes('WebSocket') || line.toLowerCase().includes('hello') || line.toLowerCase().includes('welcome')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
