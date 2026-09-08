const fs = require('fs');
const path = require('path');

const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR LATENCY METRICS ---');
  lines.forEach((line, idx) => {
    if (
      line.includes('stt_network_and_compute_ms') || 
      line.includes('local_pipeline_ms') || 
      line.includes('deepgram_network_rtt_ms') || 
      line.includes('deepgram_processing_ms')
    ) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
