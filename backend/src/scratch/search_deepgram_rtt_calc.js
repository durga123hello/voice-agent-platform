const fs = require('fs');
const path = require('path');

const sigPath = path.join(__dirname, '../services/signaling.ts');
if (fs.existsSync(sigPath)) {
  const content = fs.readFileSync(sigPath, 'utf8');
  const lines = content.split('\n');
  console.log('--- SEARCHING FOR DEEPGRAM RTT/PROCESSING CALC ---');
  
  let inMetricsBlock = false;
  let metricsSnippet = [];

  lines.forEach((line, idx) => {
    if (line.includes('deepgram_network_rtt_ms') || line.includes('deepgram_processing_ms')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
    // Also capture the block where the metrics are calculated
    if (line.includes('deepgram_network_rtt_ms = ') || line.includes('deepgram_processing_ms = ')) {
      inMetricsBlock = true;
    }
    if (inMetricsBlock) {
      metricsSnippet.push(`${idx + 1}: ${line}`);
      if (metricsSnippet.length > 50) {
        inMetricsBlock = false;
      }
    }
  });

  if (metricsSnippet.length > 0) {
    console.log('\n--- METRICS CALCULATION BLOCK ---');
    console.log(metricsSnippet.join('\n'));
  }
} else {
  console.log('File does not exist');
}
