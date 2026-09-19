import prisma from './client';

export const SYSTEM_PERMISSIONS = [
  // users
  { module: 'users', action: 'view', label: 'View Users' },
  { module: 'users', action: 'create', label: 'Create Users' },
  { module: 'users', action: 'edit', label: 'Edit Users' },
  { module: 'users', action: 'delete', label: 'Delete Users' },

  // organization
  { module: 'organization', action: 'view', label: 'View Organization' },
  { module: 'organization', action: 'edit', label: 'Edit Organization' },

  // projects
  { module: 'projects', action: 'view', label: 'View Projects' },
  { module: 'projects', action: 'create', label: 'Create Projects' },
  { module: 'projects', action: 'edit', label: 'Edit Projects' },
  { module: 'projects', action: 'delete', label: 'Delete Projects' },

  // integrations
  { module: 'integrations', action: 'view', label: 'View Integrations' },
  { module: 'integrations', action: 'create', label: 'Create Integrations' },
  { module: 'integrations', action: 'edit', label: 'Edit Integrations' },
  { module: 'integrations', action: 'delete', label: 'Delete Integrations' },

  // sessions (Call Sessions, WebRTC & Transcripts)
  { module: 'sessions', action: 'view', label: 'View Call Sessions & Recordings' },
  { module: 'sessions', action: 'create', label: 'Initiate Call Sessions' },
  { module: 'sessions', action: 'edit', label: 'Update Session Configurations' },
  { module: 'sessions', action: 'delete', label: 'Purge Call Recordings' },

  // analytics
  { module: 'analytics', action: 'view', label: 'View Call Analytics & Metrics' },
  { module: 'analytics', action: 'edit', label: 'Export Analytics Data' },

  // teams
  { module: 'teams', action: 'view', label: 'View Team Directory' },
  { module: 'teams', action: 'create', label: 'Add Team Members' },
  { module: 'teams', action: 'edit', label: 'Edit Team Assignments' },
  { module: 'teams', action: 'delete', label: 'Remove Team Members' },

  // testing
  { module: 'testing', action: 'view', label: 'View Testing Workspace' },

  // roles
  { module: 'roles', action: 'view', label: 'View Roles & Permissions' },
  { module: 'roles', action: 'create', label: 'Create Roles' },
  { module: 'roles', action: 'edit', label: 'Edit Roles & Permissions' },
  { module: 'roles', action: 'delete', label: 'Delete Roles' },

  // settings
  { module: 'settings', action: 'view', label: 'View Settings' },
  { module: 'settings', action: 'edit', label: 'Edit Settings' },

  // billing
  { module: 'billing', action: 'view', label: 'View Billing & Subscriptions' },
  { module: 'billing', action: 'edit', label: 'Edit & Manage Subscriptions' },
];

export const SYSTEM_ROLES = [
  {
    name: 'Admin',
    description: 'Full administrative access to all workspace resources, voice agents, and organization settings.',
    isSystemRole: true,
    permissionKeys: SYSTEM_PERMISSIONS.map((p) => `${p.module}:${p.action}`),
  },
  {
    name: 'Voice Engineer',
    description: 'Specialized access to manage STT/TTS/LLM agents, WebRTC call sessions, projects, and voice analytics.',
    isSystemRole: true,
    permissionKeys: [
      'users:view',
      'organization:view',
      'projects:view',
      'projects:create',
      'projects:edit',
      'integrations:view',
      'integrations:create',
      'integrations:edit',
      'sessions:view',
      'sessions:create',
      'sessions:edit',
      'analytics:view',
      'analytics:edit',
      'teams:view',
      'testing:view',
      'roles:view',
      'settings:view',
      'settings:edit',
      'billing:view',
    ],
  },
  {
    name: 'QA & Tester',
    description: 'Access to test voice workflows in simulator, initiate test call sessions, and inspect recordings & transcripts.',
    isSystemRole: true,
    permissionKeys: [
      'users:view',
      'organization:view',
      'projects:view',
      'integrations:view',
      'sessions:view',
      'sessions:create',
      'analytics:view',
      'testing:view',
      'roles:view',
      'settings:view',
      'billing:view',
    ],
  },
  {
    name: 'Member',
    description: 'Standard access to view projects, integrations, active call sessions, and team analytics.',
    isSystemRole: true,
    permissionKeys: [
      'users:view',
      'organization:view',
      'projects:view',
      'projects:create',
      'integrations:view',
      'sessions:view',
      'analytics:view',
      'teams:view',
      'testing:view',
      'roles:view',
      'settings:view',
      'billing:view',
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access across workspace resources, call logs, and system metrics.',
    isSystemRole: true,
    permissionKeys: [
      'users:view',
      'organization:view',
      'projects:view',
      'integrations:view',
      'sessions:view',
      'analytics:view',
      'teams:view',
      'testing:view',
      'roles:view',
      'settings:view',
      'billing:view',
    ],
  },
];

export const INITIAL_SUBSCRIPTION_PLANS = [
  {
    name: 'Starter',
    platformFee: 999.0,
    description: 'Ideal for small teams, startups, and basic voice agent testing with standard SLA.',
  },
  {
    name: 'Professional',
    platformFee: 4999.0,
    description: 'For growing platforms requiring ultra-low latency voice synthesis, higher concurrency & priority support.',
  },
  {
    name: 'Enterprise',
    platformFee: 19999.0,
    description: 'Dedicated infrastructure, custom WebRTC cluster routing, advanced security, and 24/7 priority SLA.',
  },
];

export async function ensureSeedSubscriptionPlans() {
  try {
    for (const plan of INITIAL_SUBSCRIPTION_PLANS) {
      const existing = await prisma.subscriptionPlan.findFirst({
        where: { name: plan.name },
      });
      if (!existing) {
        await prisma.subscriptionPlan.create({
          data: {
            name: plan.name,
            platformFee: plan.platformFee,
            description: plan.description,
            isActive: true,
          },
        });
      }
    }
  } catch (err) {
    console.error('Error seeding subscription plans:', err);
  }
}

export async function ensureSeedRbac() {
  try {
    // 1. Seed subscription plans
    await ensureSeedSubscriptionPlans();

    // 2. Seed system permissions (tenantId = null, isSystemPermission = true)
    for (const p of SYSTEM_PERMISSIONS) {
      const key = `${p.module}:${p.action}`;
      const existing = await prisma.permission.findFirst({
        where: { tenantId: null, key },
      });
      if (!existing) {
        await prisma.permission.create({
          data: {
            tenantId: null,
            key,
            module: p.module,
            action: p.action,
            label: p.label,
            isSystemPermission: true,
          },
        });
      } else {
        await prisma.permission.update({
          where: { id: existing.id },
          data: {
            module: p.module,
            action: p.action,
            label: p.label,
          },
        });
      }
    }

    // Fetch all system permissions
    const allSystemPerms = await prisma.permission.findMany({
      where: { isSystemPermission: true },
    });
    const permMap = new Map(allSystemPerms.map((p) => [p.key, p.id]));

    // 3. Seed system roles (tenantId = null, isSystemRole = true)
    for (const r of SYSTEM_ROLES) {
      let role = await prisma.role.findFirst({
        where: { tenantId: null, name: r.name },
      });
      if (!role) {
        role = await prisma.role.create({
          data: {
            tenantId: null,
            name: r.name,
            description: r.description,
            isSystemRole: true,
          },
        });
      } else {
        await prisma.role.update({
          where: { id: role.id },
          data: {
            description: r.description,
          },
        });
      }

      // Ensure role permissions linked
      for (const pKey of r.permissionKeys) {
        const permId = permMap.get(pKey);
        if (permId) {
          const rpExists = await prisma.rolePermission.findFirst({
            where: { roleId: role.id, permissionId: permId },
          });
          if (!rpExists) {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permId,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error seeding RBAC:', err);
  }
}

