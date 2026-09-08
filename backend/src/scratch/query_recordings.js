const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.agentConfig.findMany({
    include: { versions: true }
  });
  console.log("Configs:", JSON.stringify(configs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
