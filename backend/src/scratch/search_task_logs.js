const fs = require('fs');
const path = require('path');

const logDir = 'C:\\Users\\rajye\\.gemini\\antigravity\\brain\\2097d9b6-fa21-42ed-b841-652b01e37807\\.system_generated\\tasks';
if (fs.existsSync(logDir)) {
  const files = fs.readdirSync(logDir);
  console.log('Task logs found:', files);
  for (const file of files) {
    if (file.endsWith('.log')) {
      const filePath = path.join(logDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      console.log(`\n--- SEARCHING IN ${file} ---`);
      
      let matchCount = 0;
      for (const line of lines) {
        if (line.includes('[STT Granular Metrics]') || line.includes('Calculated stt_duration_ms')) {
          console.log(line.trim());
          matchCount++;
          if (matchCount > 30) {
            console.log('... truncated matching logs');
            break;
          }
        }
      }
    }
  }
} else {
  console.log('Log directory does not exist at ' + logDir);
}
