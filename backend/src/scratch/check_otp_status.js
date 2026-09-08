const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TENANTS ===');
  const tenants = await prisma.tenant.findMany();
  console.log(JSON.stringify(tenants, null, 2));

  console.log('\n=== OTP CODES ===');
  const otps = await prisma.otpCode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(otps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
