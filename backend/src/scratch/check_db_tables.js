const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- DATABASE INSPECTION VIA PRISMA ---');

  // 1. Query tables in public schema
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('\nTables in Database:');
  tables.forEach(r => console.log(`- ${r.table_name}`));

  // 2. Query columns in tenants table
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      ORDER BY ordinal_position;
    `;
    console.log('\nColumns in "tenants" table:');
    columns.forEach(c => console.log(`- ${c.column_name} (${c.data_type}, Nullable: ${c.is_nullable})`));
  } catch (err) {
    console.error('Error querying tenants table columns:', err.message);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
