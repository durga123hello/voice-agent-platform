const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/signaling.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- SEARCHING FOR "jobDescription" or "candidateResume" ---');
lines.forEach((line, idx) => {
  if (line.includes('jobDescription') || line.includes('candidateResume') || line.toLowerCase().includes('systemprompt') || line.includes('system_prompt')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
