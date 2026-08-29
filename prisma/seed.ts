import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLES } from '../src/common/permissions';

const prisma = new PrismaClient();

/** Dev-only password for every seeded demo account. Never used for real
 * user accounts — those set their own password at signup. */
const DEMO_PASSWORD = 'ChangeMe123!';

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'event'
  );
}

async function main() {
  // --- Roles: idempotent upsert so re-running seed never duplicates them.
  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, permissions: role.permissions, isSystem: true },
      create: { name: role.name, description: role.description, permissions: role.permissions, isSystem: true },
    });
  }

  const organizerRole = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.ORGANIZER } });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.SUPER_ADMIN } });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Demo users. Sign in with these at /signin, or sign up your own —
  // the very first account anyone creates is an ORGANIZER by default.
  // Only an existing Super Admin (or this seed script) can grant SUPER_ADMIN.
  const email = 'demo.organizer@pulseframe.app';
  const user =
    (await prisma.user.findUnique({ where: { email } })) ||
    (await prisma.user.create({
      data: {
        name: 'Demo Organizer',
        email,
        password: passwordHash,
        roleId: organizerRole.id,
      },
    }));

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'superadmin@pulseframe.app').toLowerCase().trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'SuperAdminPass2026!';
  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

  let superAdminUser = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        name: 'Master Super Admin',
        email: superAdminEmail,
        password: superAdminPasswordHash,
        roleId: superAdminRole.id,
      },
    });
  } else {
    // Ensure Super Admin has super admin role & password updated
    superAdminUser = await prisma.user.update({
      where: { id: superAdminUser.id },
      data: { roleId: superAdminRole.id, password: superAdminPasswordHash },
    });
  }

  // Also keep default admin@pulseframe.app if different
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pulseframe.app').toLowerCase().trim();
  if (adminEmail !== superAdminEmail) {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          name: 'System Admin',
          email: adminEmail,
          password: passwordHash,
          roleId: superAdminRole.id,
        },
      });
    }
  }



  // Note: transactional email designs are static code templates now (see
  // backend/src/mail/templates/email-templates.ts) — nothing to seed here.
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
