const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/page.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR LINKS ---');
  lines.forEach((line, idx) => {
    if (line.includes('Link') || line.includes('href=') || line.includes('sessions') || line.includes('test-voice') || line.includes('analytics')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
