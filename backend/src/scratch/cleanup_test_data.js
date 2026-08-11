const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== STARTING DATABASE CLEANUP ===\n');

  // 1. Find tenants to delete
  // We want to target:
  // - "Big Organization Corp" / org-39470@bigorg.com (and any other bigorg.com emails)
  // - "Tenant A Corp" / tenant-a-...@test.com
  // - "Tenant B Corp" / tenant-b-...@test.com
  // - "Passwordless Corp" / otp-org-...@passwordless.com
  // - "RateLimit Test" / ratelimit-...@ratelimit.com
  const allTenants = await prisma.tenant.findMany();
  
  console.log('Current Tenants in DB:');
  allTenants.forEach(t => console.log(`- "${t.name}" (Email: ${t.contactEmail}, ID: ${t.id})`));

  const realTenants = ['Default Tenant', 'Wipro', 'google'];
  const tenantsToDelete = allTenants.filter(t => {
    const name = t.name || '';
    const email = t.contactEmail || '';
    
    // Check if it matches any of the synthetic/test names or emails
    const isSyntheticName = 
      name.includes('Big Organization') ||
      name.includes('Tenant A') ||
      name.includes('Tenant B') ||
      name.includes('Passwordless Corp') ||
      name.includes('RateLimit Test');

    const isSyntheticEmail = 
      email.includes('@bigorg.com') ||
      email.includes('@test.com') ||
      email.includes('@passwordless.com') ||
      email.includes('@ratelimit.com');

    // Make sure we never delete the real ones
    const isReal = realTenants.includes(name);

    return (isSyntheticName || isSyntheticEmail) && !isReal;
  });

  console.log('\nTenants identified for deletion:');
  tenantsToDelete.forEach(t => console.log(`- "${t.name}" (Email: ${t.contactEmail}, ID: ${t.id})`));

  if (tenantsToDelete.length === 0) {
    console.log('\nNo test tenants found to delete.');
  } else {
    // Delete them one by one (cascade will automatically handle related records)
    for (const tenant of tenantsToDelete) {
      console.log(`Deleting tenant "${tenant.name}" (ID: ${tenant.id})...`);
      await prisma.tenant.delete({
        where: { id: tenant.id }
      });
    }
    console.log('\nCascade deletion completed successfully.');
  }

  // 2. Query remaining tenants
  const remainingTenants = await prisma.tenant.findMany();
  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Remaining Tenants Count: ${remainingTenants.length}`);
  console.log('Remaining Tenants List:');
  remainingTenants.forEach(t => {
    console.log(`- "${t.name}" (Email: ${t.contactEmail || 'N/A'}, ID: ${t.id})`);
  });

  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
