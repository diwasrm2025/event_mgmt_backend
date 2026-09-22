"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const permissions_1 = require("../src/common/permissions");
const prisma = new client_1.PrismaClient();
const DEMO_PASSWORD = 'ChangeMe123!';
function slugify(value) {
    return (value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'event');
}
async function main() {
    for (const role of permissions_1.SYSTEM_ROLE_DEFINITIONS) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: { description: role.description, permissions: role.permissions, isSystem: true },
            create: { name: role.name, description: role.description, permissions: role.permissions, isSystem: true },
        });
    }
    const organizerRole = await prisma.role.findUniqueOrThrow({ where: { name: permissions_1.SYSTEM_ROLES.ORGANIZER } });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: permissions_1.SYSTEM_ROLES.SUPER_ADMIN } });
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const email = 'demo.organizer@pulseframe.app';
    const user = (await prisma.user.findUnique({ where: { email } })) ||
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
    }
    else {
        superAdminUser = await prisma.user.update({
            where: { id: superAdminUser.id },
            data: { roleId: superAdminRole.id, password: superAdminPasswordHash },
        });
    }
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
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map