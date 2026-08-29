import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SYSTEM_ROLES } from '../common/permissions';

type UserWithRole = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: { name: string; permissions: string[] };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: { id: string }) {
    return this.jwt.sign({ sub: user.id });
  }

  private toPublicUser(user: UserWithRole) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      permissions: user.role.permissions,
    };
  }

  /** New accounts default to ORGANIZER — Super Admin is never
   * self-assignable, only granted by an existing Super Admin (or the seed
   * script). */
  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const organizerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.ORGANIZER } });
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        password: passwordHash,
        roleId: organizerRole.id,
      },
      include: { role: true },
    });

    return { token: this.sign(user), user: this.toPublicUser(user) };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user) throw new UnauthorizedException('Incorrect email or password.');

    const matches = await bcrypt.compare(dto.password, user.password);
    if (!matches) throw new UnauthorizedException('Incorrect email or password.');

    return { token: this.sign(user), user: this.toPublicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) throw new BadRequestException('Current password is incorrect.');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });
    return { success: true };
  }

  async updateProfile(userId: string, name?: string) {
    const data: { name?: string } = {};
    if (name) data.name = name.trim();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { role: true },
    });
    return this.toPublicUser(user);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided.');
    const avatarUrl = `/uploads/${file.filename}`;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: { role: true },
    });
    return this.toPublicUser(user);
  }
}
