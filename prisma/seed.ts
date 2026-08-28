/**
 * Database seed — roles, permissions and the first admin.
 *
 * Idempotent by design: every write is an upsert keyed on a natural key, so
 * running this against an already-seeded database changes nothing. That is what
 * makes it safe to run on every deploy, and it is why the DoD asks for
 * "reproducible from scratch" rather than "run once".
 *
 * Nothing here invents a BARFF fact. Roles and permissions are technical
 * vocabulary; commercial settings (minimum order quantity, dealer tiers, price
 * lists) are business facts BARFF has not supplied and stay out until they do —
 * see docs/OPEN-QUESTIONS.md.
 */
import { PrismaClient } from '../services/api/generated/prisma/index.js';
import { Role as RoleKey } from '@barff/types';
import { hashPassword } from '../services/api/src/common/crypto/password.js';
import { mockProductsRequested, seedMockProducts } from './seed-mock-products.js';
import { seedContentSkeleton } from './seed-content.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * The six system roles from CLAUDE.md §3.
 *
 * Keys come from `@barff/types` rather than being retyped here: a typo would
 * otherwise seed a role the API's `@Roles()` decorators never match, and the
 * failure would show up as a mysterious 403 rather than a broken seed.
 */
const ROLE_DEFINITIONS: { key: RoleKey; name: string; description: string }[] = [
  {
    key: RoleKey.ADMIN,
    name: 'Administrator',
    description: 'Full access to the CMS, operations and system settings.',
  },
  {
    key: RoleKey.SALES,
    name: 'Sales',
    description: 'Leads, dealers, orders and sales reporting.',
  },
  {
    key: RoleKey.WAREHOUSE,
    name: 'Warehouse',
    description: 'Stock, reservations, picking and packing.',
  },
  {
    key: RoleKey.LOGISTICS,
    name: 'Logistics',
    description: 'Delivery queue, driver assignment and routes.',
  },
  {
    key: RoleKey.DRIVER,
    name: 'Driver',
    description: 'Own delivery assignments and proof of delivery.',
  },
  {
    key: RoleKey.DEALER,
    name: 'Dealer',
    description: 'Dealer portal: catalogue, cart, orders, invoices.',
  },
];

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Baseline permission set, addressed as `resource:action`.
 *
 * Endpoints are guarded by permission, not by role name, so a new role later is
 * a data change rather than an edit to every controller. Later steps add their
 * own resources; this covers what S04–S06 need plus the modules already named
 * in CLAUDE.md §11.
 *
 * `:read_own` and `:update_own` exist where a role may only touch its own rows
 * — a driver seeing another driver's deliveries would be a data leak, and the
 * distinction has to exist in the permission set before a guard can enforce it.
 */
const PERMISSION_DEFINITIONS: { resource: string; action: string; description: string }[] = [
  { resource: 'users', action: 'read', description: 'View user accounts' },
  { resource: 'users', action: 'create', description: 'Create user accounts' },
  { resource: 'users', action: 'update', description: 'Update user accounts' },
  { resource: 'users', action: 'delete', description: 'Deactivate user accounts' },
  { resource: 'roles', action: 'read', description: 'View roles and permissions' },
  { resource: 'roles', action: 'assign', description: 'Grant or revoke a user role' },

  { resource: 'dealers', action: 'read', description: 'View dealer accounts' },
  { resource: 'dealers', action: 'create', description: 'Create dealer accounts' },
  { resource: 'dealers', action: 'update', description: 'Update dealer accounts' },
  { resource: 'dealers', action: 'approve', description: 'Approve or reject a registration' },

  { resource: 'products', action: 'read', description: 'View products' },
  {
    resource: 'products',
    action: 'read_all',
    description: 'View products including unpublished drafts (admin catalogue)',
  },
  { resource: 'products', action: 'create', description: 'Create products' },
  { resource: 'products', action: 'update', description: 'Update products' },
  { resource: 'products', action: 'delete', description: 'Remove products' },
  { resource: 'pricing', action: 'read', description: 'View price rules' },
  { resource: 'pricing', action: 'update', description: 'Change price rules' },

  { resource: 'orders', action: 'read', description: 'View all orders' },
  { resource: 'orders', action: 'read_own', description: 'View own orders' },
  { resource: 'orders', action: 'create', description: 'Submit an order' },
  { resource: 'orders', action: 'update_status', description: 'Advance an order status' },
  { resource: 'orders', action: 'cancel', description: 'Cancel an order' },

  { resource: 'warehouse', action: 'read', description: 'View stock and movements' },
  { resource: 'warehouse', action: 'reserve', description: 'Reserve or release stock' },
  { resource: 'warehouse', action: 'adjust', description: 'Adjust stock with a reason' },
  { resource: 'warehouse', action: 'pick', description: 'Pick and pack orders' },

  { resource: 'delivery', action: 'read', description: 'View all deliveries' },
  { resource: 'delivery', action: 'read_own', description: 'View own assignments' },
  { resource: 'delivery', action: 'assign', description: 'Assign a driver' },
  { resource: 'delivery', action: 'update_status', description: 'Change any delivery status' },
  {
    resource: 'delivery',
    action: 'update_status_own',
    description: 'Change the status of an own assignment',
  },
  { resource: 'drivers', action: 'read', description: 'View drivers and vehicles' },
  { resource: 'drivers', action: 'update', description: 'Manage drivers and vehicles' },

  { resource: 'invoices', action: 'read', description: 'View all invoices' },
  { resource: 'invoices', action: 'read_own', description: 'View own invoices' },
  { resource: 'invoices', action: 'create', description: 'Issue invoices' },
  { resource: 'payments', action: 'read', description: 'View payments and balances' },
  { resource: 'payments', action: 'create', description: 'Record a payment' },

  { resource: 'leads', action: 'read', description: 'View B2B leads' },
  { resource: 'leads', action: 'update', description: 'Advance a lead through the pipeline' },

  { resource: 'content', action: 'read', description: 'View CMS content' },
  { resource: 'content', action: 'update', description: 'Edit CMS content' },
  { resource: 'content', action: 'publish', description: 'Publish or unpublish content' },
  { resource: 'media', action: 'read', description: 'View the media library' },
  { resource: 'media', action: 'upload', description: 'Upload media' },
  { resource: 'media', action: 'delete', description: 'Delete media' },

  { resource: 'reports', action: 'read', description: 'View reports and exports' },
  { resource: 'settings', action: 'read', description: 'View system settings' },
  { resource: 'settings', action: 'update', description: 'Change system settings' },
  { resource: 'audit', action: 'read', description: 'View the audit log' },
];

const permissionKey = (resource: string, action: string): string => `${resource}:${action}`;

const ALL_PERMISSION_KEYS = PERMISSION_DEFINITIONS.map((p) => permissionKey(p.resource, p.action));

/**
 * Role → permission grants.
 *
 * ADMIN is computed rather than listed, so a permission added above is never
 * accidentally withheld from the administrator. Every other role is explicit:
 * an over-broad grant is a security bug, and "whatever is left over" is not a
 * decision anyone reviewed.
 */
const ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  [RoleKey.ADMIN]: ALL_PERMISSION_KEYS,

  [RoleKey.SALES]: [
    'leads:read',
    'leads:update',
    'dealers:read',
    'dealers:create',
    'dealers:update',
    'dealers:approve',
    'orders:read',
    'products:read',
    'products:read_all',
    'pricing:read',
    'invoices:read',
    'payments:read',
    'reports:read',
  ],

  [RoleKey.WAREHOUSE]: [
    'warehouse:read',
    'warehouse:reserve',
    'warehouse:adjust',
    'warehouse:pick',
    'orders:read',
    'orders:update_status',
    'products:read',
    'products:read_all',
  ],

  [RoleKey.LOGISTICS]: [
    'delivery:read',
    'delivery:assign',
    'delivery:update_status',
    'drivers:read',
    'drivers:update',
    'orders:read',
    'warehouse:read',
  ],

  // Deliberately narrow: a driver sees the jobs assigned to them and nothing
  // else. Anything wider would expose other dealers' addresses.
  [RoleKey.DRIVER]: ['delivery:read_own', 'delivery:update_status_own'],

  // Dealers act through the portal's own scoped endpoints. They may read and
  // create their own orders — never anyone else's, and never any admin data.
  [RoleKey.DEALER]: ['products:read', 'orders:read_own', 'orders:create', 'invoices:read_own'],
};

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

/**
 * Technical defaults only.
 *
 * Commercial values — minimum order quantity, dealer tiers, credit limits,
 * delivery regions — are BARFF facts that have not been supplied (Q-006,
 * Q-007). Seeding a plausible-looking number would put an invented business
 * rule into production data, so they are absent rather than guessed.
 */
const SYSTEM_SETTINGS: { key: string; value: unknown; description: string; isPublic: boolean }[] = [
  {
    key: 'site.default_locale',
    value: 'uz',
    description: 'Default language for the public website.',
    isPublic: true,
  },
  {
    key: 'site.supported_locales',
    value: ['uz', 'ru', 'en'],
    description: 'Languages the public website is served in.',
    isPublic: true,
  },
  {
    key: 'site.maintenance_mode',
    value: false,
    description: 'When true the public website shows a maintenance page.',
    isPublic: true,
  },
  {
    key: 'orders.require_admin_review',
    value: true,
    description:
      'When true a submitted dealer order enters PENDING_REVIEW instead of being confirmed automatically.',
    isPublic: false,
  },
];

// ---------------------------------------------------------------------------

async function seedRoles(): Promise<Map<RoleKey, string>> {
  const ids = new Map<RoleKey, string>();

  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: definition.key },
      // Name and description may be corrected over time; `isSystem` and the key
      // are the parts code depends on.
      update: { name: definition.name, description: definition.description, isSystem: true },
      create: {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
    });
    ids.set(definition.key, role.id);
  }

  return ids;
}

async function seedPermissions(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const definition of PERMISSION_DEFINITIONS) {
    const key = permissionKey(definition.resource, definition.action);
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
      create: {
        key,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
    });
    ids.set(key, permission.id);
  }

  return ids;
}

async function seedRolePermissions(
  roleIds: Map<RoleKey, string>,
  permissionIds: Map<string, string>,
): Promise<number> {
  let granted = 0;

  for (const [roleKey, keys] of Object.entries(ROLE_PERMISSIONS) as [RoleKey, string[]][]) {
    const roleId = roleIds.get(roleKey);
    if (roleId === undefined) throw new Error(`Role ${roleKey} was not seeded`);

    const permissionIdsForRole = keys.map((key) => {
      const id = permissionIds.get(key);
      // A typo here would silently grant nothing, and the resulting 403 would
      // be blamed on the guard rather than on the seed.
      if (id === undefined) throw new Error(`Unknown permission "${key}" granted to ${roleKey}`);
      return id;
    });

    // Revoking is as important as granting: if a permission is removed from a
    // role above, re-running the seed must actually take it away.
    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: permissionIdsForRole } },
    });

    await prisma.rolePermission.createMany({
      data: permissionIdsForRole.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });

    granted += permissionIdsForRole.length;
  }

  return granted;
}

async function seedSystemSettings(): Promise<void> {
  for (const setting of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      // Only description and visibility are corrected on re-run: overwriting
      // `value` would silently undo an admin's change on every deploy.
      update: { description: setting.description, isPublic: setting.isPublic },
      create: {
        key: setting.key,
        value: setting.value as never,
        description: setting.description,
        isPublic: setting.isPublic,
      },
    });
  }
}

async function seedAdminUser(roleIds: Map<RoleKey, string>): Promise<string | undefined> {
  const email = process.env['SEED_ADMIN_EMAIL']?.trim().toLowerCase();
  const password = process.env['SEED_ADMIN_PASSWORD'];

  if (!email || !password) {
    // Not an error: staging and production seed roles and permissions but
    // create their administrator out of band. Only local development wants a
    // known login.
    console.warn(
      'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping the admin user. ' +
        'Roles, permissions and settings were still seeded.',
    );
    return undefined;
  }

  if (password.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters.');
  }

  const adminRoleId = roleIds.get(RoleKey.ADMIN);
  if (adminRoleId === undefined) throw new Error('ADMIN role was not seeded');

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    // The password is not reset on re-run. Overwriting it would hand anyone who
    // can trigger a deploy a way to reset the administrator's credentials.
    update: { isActive: true },
    create: {
      email,
      passwordHash,
      firstName: 'BARFF',
      lastName: 'Administrator',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRoleId } },
    update: {},
    create: { userId: user.id, roleId: adminRoleId },
  });

  return user.email;
}

async function main(): Promise<void> {
  console.info('Seeding BARFF core data…');

  const roleIds = await seedRoles();
  console.info(`  roles:        ${roleIds.size}`);

  const permissionIds = await seedPermissions();
  console.info(`  permissions:  ${permissionIds.size}`);

  const granted = await seedRolePermissions(roleIds, permissionIds);
  console.info(`  grants:       ${granted}`);

  await seedSystemSettings();
  console.info(`  settings:     ${SYSTEM_SETTINGS.length}`);

  const adminEmail = await seedAdminUser(roleIds);
  console.info(`  admin user:   ${adminEmail ?? 'skipped (no SEED_ADMIN_* env)'}`);

  // Structural, not placeholder content — seeded everywhere. See
  // prisma/seed-content.ts.
  const content = await seedContentSkeleton(prisma);
  console.info(`  production steps: ${content.steps}`);
  console.info(`  page sections:    ${content.sections}`);

  // Opt-in, and never in production. See prisma/seed-mock-products.ts.
  if (mockProductsRequested()) {
    const products = await seedMockProducts(prisma);
    console.info(`  MOCK products: ${products}`);
  } else {
    console.info('  MOCK products: skipped (set SEED_MOCK_PRODUCTS=true for local development)');
  }

  console.info('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
