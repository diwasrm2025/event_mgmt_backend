import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SYSTEM_ROLES } from '../common/permissions';
import { MailService } from '../mail/mail.service';
import { roleUpdateEmail } from '../mail/templates/email-templates';

const APP_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A role with that name already exists.');
    return this.prisma.role.create({
      data: { name: dto.name, description: dto.description ?? '', permissions: dto.permissions, isSystem: false },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles (SUPER_ADMIN, ORGANIZER, ATTENDEE) cannot be modified.');
    }
    return this.prisma.role.update({
      where: { id },
      data: {
        description: dto.description ?? role.description,
        permissions: dto.permissions ?? role.permissions,
      },
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }
    const usersWithRole = await this.prisma.user.count({ where: { roleId: id } });
    if (usersWithRole > 0) {
      throw new BadRequestException('Reassign the users on this role before deleting it.');
    }
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  /** Assigns a role to a user. Guards against ever leaving zero Super
   * Admins in the system, which would permanently lock everyone out of
   * admin-only actions. */
  async assignToUser(userId: string, dto: AssignRoleDto, actingUserId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found.');
    if (!role) throw new NotFoundException('Role not found.');

    if (user.role.name === SYSTEM_ROLES.SUPER_ADMIN && role.name !== SYSTEM_ROLES.SUPER_ADMIN) {
      const otherSuperAdmins = await this.prisma.user.count({
        where: { role: { name: SYSTEM_ROLES.SUPER_ADMIN } },
        // exclude the user being changed
      });
      if (otherSuperAdmins <= 1) {
        throw new BadRequestException('At least one Super Admin must remain in the system.');
      }
    }

    if (userId === actingUserId && role.name !== SYSTEM_ROLES.SUPER_ADMIN && user.role.name === SYSTEM_ROLES.SUPER_ADMIN) {
      throw new BadRequestException('You cannot demote yourself from Super Admin.');
    }

    const oldRoleName = user.role.name;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: dto.roleId },
      include: { role: true },
    });

    if (oldRoleName !== role.name) {
      await this.sendRoleUpdateEmail({
        name: updated.name || updated.email.split('@')[0],
        email: updated.email,
        oldRole: oldRoleName,
        newRole: role.name,
      });
    }

    return updated;
  }

  /** Sends the "your role has changed" email using the static, built-in
   * template (fixed in code — not editable via the database/Super Admin).
   * Never throws: a failed email must not roll back or block the role
   * change itself. */
  private async sendRoleUpdateEmail(ctx: { name: string; email: string; oldRole: string; newRole: string }) {
    try {
      const html = roleUpdateEmail({
        name: ctx.name,
        email: ctx.email,
        oldRole: ctx.oldRole,
        newRole: ctx.newRole,
        appUrl: APP_URL,
      });
      await this.mail.sendMail(ctx.email, 'Your Role Has Been Updated', html);
    } catch {
      // Mail failures must never break a role assignment.
    }
  }
}
