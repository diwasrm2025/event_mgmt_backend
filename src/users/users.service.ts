import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SYSTEM_ROLES } from '../common/permissions';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with that email already exists.');

    let roleId = dto.roleId;
    if (!roleId) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: SYSTEM_ROLES.ORGANIZER },
      });
      if (!defaultRole) throw new NotFoundException('Default role is not configured.');
      roleId = defaultRole.id;
    } else {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
      if (!role) throw new NotFoundException('Specified role not found.');
    }

    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        password: await bcrypt.hash(dto.password, 10),
        roleId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async createOrganizer(dto: CreateOrganizerDto) {
    return this.createUser(dto);
  }

  async deleteUser(userId: string, currentUserId: string) {
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.eventPermission.updateMany({
        where: { grantedById: userId },
        data: { grantedById: null },
      });

      await tx.eventPermission.deleteMany({
        where: { userId },
      });

      await tx.notification.deleteMany({
        where: { userId },
      });

      await tx.activity.deleteMany({
        where: { userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });

      return { success: true, message: 'User deleted successfully.' };
    });
  }

  /** Lightweight search used by the "grant access" searchable dropdown on
   * an event's permissions panel — returns a small, name/email-matched
   * list rather than the full user table. */
  search(query: string, excludeUserId?: string) {
    return this.prisma.user.findMany({
      where: {
        AND: [
          excludeUserId ? { id: { not: excludeUserId } } : {},
          query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 10,
      orderBy: { name: 'asc' },
    });
  }
}
