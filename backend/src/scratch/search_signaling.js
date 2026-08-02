const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/page.tsx'); // oops let's make it for signaling
const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR handleSignaling ---');
  lines.forEach((line, idx) => {
    if (line.includes('function handleSignaling') || line.includes('handleSignaling')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist at ' + sigPath);
}
