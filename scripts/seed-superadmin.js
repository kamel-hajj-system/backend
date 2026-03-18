const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env from backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'superadmin');
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'superadmin');

async function seedSuperAdmin() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.warn('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set; skipping super admin seed.');
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: existing.fullName || 'Super Administrator',
        fullNameAr: existing.fullNameAr || 'مدير النظام',
        passwordHash,
        userType: 'SuperAdmin',
        role: 'EmpManage',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    console.log('Super admin updated.');
  } else {
    await prisma.user.create({
      data: {
        fullName: 'Super Administrator',
        fullNameAr: 'مدير النظام',
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        userType: 'SuperAdmin',
        role: 'EmpManage',
        isActive: true,
        isSuperAdmin: true,
      },
    });
    console.log('Super admin created.');
  }

  console.log('Use SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from env to log in.');
}

seedSuperAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

