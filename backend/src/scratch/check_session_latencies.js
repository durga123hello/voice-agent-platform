const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== SEARCHING FOR SESSION LATENCY EVENTS ===\n');

  // Find the session starting with ae47aa9
  const sessions = await prisma.session.findMany();
  const session = sessions.find(s => s.id.startsWith('ae47aa9'));

  if (!session) {
    console.log('No session found starting with "ae47aa9". Let\'s print all sessions to see what exists:');
    sessions.forEach(s => console.log(`- ${s.id} (startedAt: ${s.startedAt})`));
    await prisma.$disconnect();
    return;
  }

  console.log(`Found Session ID: ${session.id}`);

  // Query all turn_latency events for this session
  const events = await prisma.sessionEvent.findMany({
    where: {
      sessionId: session.id,
      eventType: 'turn_latency'
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nFound ${events.length} turn_latency events:`);
  events.forEach((ev, idx) => {
    console.log(`\nTurn ${idx + 1} (Created: ${ev.createdAt}):`);
    console.log(JSON.stringify(ev.metadata, null, 2));
  });

  await prisma.$disconnect();
}

run().catch(console.error);
