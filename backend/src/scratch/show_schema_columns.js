const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying sessions table column definitions directly from PostgreSQL...');
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position;
    `;
    console.log('\n=== PostgreSQL SESSIONS TABLE COLUMNS ===');
    console.table(columns);
  } catch (error) {
    console.error('Failed to run raw query:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
