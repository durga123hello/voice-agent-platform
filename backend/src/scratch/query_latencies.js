const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== RECENT TURN LATENCY EVENTS ===');
  const events = await prisma.sessionEvent.findMany({
    where: {
      eventType: 'turn_latency'
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  for (const event of events) {
    console.log(`\nSession: ${event.sessionId} | Created: ${event.createdAt.toISOString()}`);
    console.log(JSON.stringify(event.metadata, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
