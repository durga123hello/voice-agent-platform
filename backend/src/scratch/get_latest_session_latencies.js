const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== GETTING LATEST SESSION LATENCY EVENTS ===\n');

  // Find the most recent session
  const latestSession = await prisma.session.findFirst({
    orderBy: { startedAt: 'desc' }
  });

  if (!latestSession) {
    console.log('No sessions found in the database.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Latest Session ID: ${latestSession.id}`);
  console.log(`Started At: ${latestSession.startedAt}`);
  console.log(`Ended At: ${latestSession.endedAt}`);
  console.log(`Status: ${latestSession.status}\n`);

  // Query all turn_latency events for this session
  const events = await prisma.sessionEvent.findMany({
    where: {
      sessionId: latestSession.id,
      eventType: 'turn_latency'
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${events.length} turn_latency events:`);
  events.forEach((ev, idx) => {
    const meta = ev.metadata || {};
    console.log(`\nTurn ${idx + 1} (Created: ${ev.createdAt}):`);
    console.log(`- stt_network_and_compute_ms (Parent): ${meta.stt_network_and_compute_ms}ms`);
    console.log(`- local_pipeline_ms: ${meta.local_pipeline_ms}ms`);
    console.log(`- deepgram_network_rtt_ms: ${meta.deepgram_network_rtt_ms}ms`);
    console.log(`- deepgram_processing_ms: ${meta.deepgram_processing_ms}ms`);
    console.log(`- interim_transcript_count: ${meta.interim_transcript_count}`);
    console.log(`- totalTurnMs: ${meta.totalTurnMs}ms`);
  });

  // Query messages
  const messages = await prisma.message.findMany({
    where: { sessionId: latestSession.id },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nConversation Transcript:`);
  messages.forEach(m => {
    console.log(`- ${m.role}: "${m.content}"`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
