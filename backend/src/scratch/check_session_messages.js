const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== SEARCHING FOR SESSION EVENTS AND LOGS ===\n');

  const sessionId = '62559db9-7062-48d3-8bdf-75d32427e06c';
  
  // Get all session events
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${events.length} events for session ${sessionId}:`);
  events.forEach((ev, idx) => {
    console.log(`\nEvent ${idx + 1} (${ev.eventType}):`);
    console.log(JSON.stringify(ev.metadata, null, 2));
  });

  // Get messages
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nFound ${messages.length} messages:`);
  messages.forEach(m => {
    console.log(`- ${m.role}: "${m.content}"`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
