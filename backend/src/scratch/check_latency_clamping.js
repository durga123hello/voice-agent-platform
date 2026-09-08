const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the latest session with turn_latency events
  const latestLatencyEvent = await prisma.sessionEvent.findFirst({
    where: { eventType: 'turn_latency' },
    orderBy: { createdAt: 'desc' }
  });

  if (!latestLatencyEvent) {
    console.log('No turn_latency events found in database.');
    return;
  }

  const sessionId = latestLatencyEvent.sessionId;
  console.log(`=== LATENCY BREAKDOWN FOR SESSION: ${sessionId} ===`);

  const events = await prisma.sessionEvent.findMany({
    where: {
      sessionId,
      eventType: 'turn_latency'
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${events.length} turns:`);
  events.forEach((event, index) => {
    const meta = event.metadata || {};
    const stt = meta.stt_network_and_compute_ms || 0;
    const local = meta.local_pipeline_ms || 0;
    const rtt = meta.deepgram_network_rtt_ms || 0;
    const proc = meta.deepgram_processing_ms || 0;
    const sum = local + rtt + proc;
    const diff = stt - sum;

    console.log(`\nTurn ${index + 1}:`);
    console.log(`  stt_network_and_compute_ms: ${stt}ms`);
    console.log(`  local_pipeline_ms:          ${local}ms`);
    console.log(`  deepgram_network_rtt_ms:    ${rtt}ms`);
    console.log(`  deepgram_processing_ms:     ${proc}ms`);
    console.log(`  Sum of sub-components:      ${sum}ms`);
    console.log(`  Difference (total - sum):   ${diff}ms`);
    console.log(`  Consistent?                 ${Math.abs(diff) < 1 ? 'YES' : 'NO'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
