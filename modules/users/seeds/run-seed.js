/**
 * Seed script: ensure super admin exists.
 * Run: npm run db:seed
 * Uses shared scripts to ensure DATABASE_URL and migrations (with self-heal), then seeds.
 */
const path = require('path');

// Load env and set DATABASE_URL from PG* if needed (shared logic)
const { ensureDatabaseUrl } = require('../../../scripts/lib/db-env.js');
ensureDatabaseUrl(path.resolve(__dirname, '../../../.env'));

const { runEnsureMigrations } = require('../../../scripts/ensure-migrations.js');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const {
  PERMISSION_SEED,
  DEFAULT_PERMISSIONS_COMPANY,
  DEFAULT_PERMISSIONS_SERVICE_CENTER,
} = require('../../permissions/constants');

const prisma = new PrismaClient();

// Super admin credentials from env. In production set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? (process.env.NODE_ENV === 'production' ? '' : 'superadmin');
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'superadmin');
const SALT_ROUNDS = 12;

function time(h, m = 0) {
  const d = new Date(0);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

async function seedPermissions() {
  for (const p of PERMISSION_SEED) {
    await prisma.permission.upsert({
      where: { name: p.name },
      create: { name: p.name, module: p.module || null, description: p.description || null },
      update: { module: p.module || null, description: p.description || null },
    });
  }
  console.log('Permissions seeded.');

  const defaultCount = await prisma.defaultPermission.count();
  if (defaultCount > 0) {
    console.log('Default permissions already seeded.');
    return;
  }
  const perms = await prisma.permission.findMany({
    where: { name: { in: [...DEFAULT_PERMISSIONS_COMPANY, ...DEFAULT_PERMISSIONS_SERVICE_CENTER] } },
    select: { id: true, name: true },
  });
  const byName = Object.fromEntries(perms.map((p) => [p.name, p.id]));
  const companyIds = DEFAULT_PERMISSIONS_COMPANY.map((n) => byName[n]).filter(Boolean);
  const serviceCenterIds = DEFAULT_PERMISSIONS_SERVICE_CENTER.map((n) => byName[n]).filter(Boolean);
  if (companyIds.length) {
    await prisma.defaultPermission.createMany({
      data: companyIds.map((permissionId) => ({ userType: 'Company', permissionId })),
    });
  }
  if (serviceCenterIds.length) {
    await prisma.defaultPermission.createMany({
      data: serviceCenterIds.map((permissionId) => ({ userType: 'ServiceCenter', permissionId })),
    });
  }
  console.log('Default permissions (Company & ServiceCenter) seeded.');
}

async function seedShifts() {
  const count = await prisma.shift.count();
  if (count > 0) {
    console.log('Shifts already seeded.');
    return;
  }
  await prisma.shift.createMany({
    data: [
      { name: 'Shift 1', startTime: time(6, 0), endTime: time(14, 0), isForEmployee: true },
      { name: 'Shift 2', startTime: time(14, 0), endTime: time(22, 0), isForEmployee: true },
      { name: 'Shift 3', startTime: time(22, 0), endTime: time(6, 0), isForEmployee: true },
      { name: 'Shift 4', startTime: time(6, 0), endTime: time(18, 0), isForEmployee: false },
      { name: 'Shift 5', startTime: time(18, 0), endTime: time(6, 0), isForEmployee: false },
    ],
  });
  console.log('Seeded 5 shifts (Shift 1–3 for employees, Shift 4–5 for senior staff).');
}

async function seed() {
  await runEnsureMigrations();
  await seedPermissions();
  await seedShifts();

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Super admin not seeded: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in the environment.');
    }
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { email: SUPER_ADMIN_EMAIL, isSuperAdmin: true },
  });

  if (existing) {
    console.log('Super admin already exists.');
    const updates = {};
    if (!existing.fullNameAr) updates.fullNameAr = 'مدير النظام';
    if (SUPER_ADMIN_PASSWORD) {
      updates.passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
    }
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: updates });
      if (updates.fullNameAr) console.log('Updated super admin fullNameAr to مدير النظام.');
      if (updates.passwordHash) console.log('Updated super admin password from SUPER_ADMIN_PASSWORD.');
    }
    return;
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
  await prisma.user.create({
    data: {
      fullName: 'Super Administrator',
      fullNameAr: 'مدير النظام',
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      userType: 'Company',
      role: 'Admin',
      shiftId: null,
      isActive: true,
      isSuperAdmin: true,
    },
  });
  console.log('Super admin created. Use SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from env to log in.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
