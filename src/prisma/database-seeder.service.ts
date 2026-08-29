import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLES } from '../common/permissions';

const DEFAULT_SUPER_ADMIN_EMAIL = 'superadmin@pulseframe.app';
const DEFAULT_SUPER_ADMIN_USERNAME = 'superadmin';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'SuperAdminPass2026!';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    for (const role of SYSTEM_ROLE_DEFINITIONS) {
      await this.prisma.role.upsert({
        where: { name: role.name },
        update: {
          description: role.description,
          permissions: role.permissions,
          isSystem: true,
        },
        create: {
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: true,
        },
      });
    }

    const email = (this.config.get<string>('SUPER_ADMIN_EMAIL') || DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase();
    const username = (this.config.get<string>('SUPER_ADMIN_USERNAME') || DEFAULT_SUPER_ADMIN_USERNAME).trim();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD') || DEFAULT_SUPER_ADMIN_PASSWORD;
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.SUPER_ADMIN } });
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing) {
      await this.prisma.user.create({
        data: {
          name: username,
          email,
          password: await bcrypt.hash(password, 10),
          roleId: role.id,
        },
      });
    } else if (existing.roleId !== role.id) {
      // Keep an existing user's password and profile intact; only restore the
      // required administrative role if it was removed.
      await this.prisma.user.update({ where: { id: existing.id }, data: { roleId: role.id } });
    }
  }
}
