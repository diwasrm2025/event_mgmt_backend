import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SYSTEM_ROLES } from '../common/permissions';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
const sharp: typeof import('sharp').default = require('sharp');

type UserWithRole = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: { name: string; permissions: string[] };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cloudinary: CloudinaryService,
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

  /** Public signups are attendees. Event-creator access is granted by a
   * Super Admin rather than being self-assigned during registration. */
  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const attendeeRole = await this.prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.ATTENDEE } });
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        password: passwordHash,
        roleId: attendeeRole.id,
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

  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided.');
    let format: string | undefined;
    try {
      format = (await sharp(file.buffer).metadata()).format;
    } catch {
      throw new BadRequestException('The uploaded file is not a supported image.');
    }
    if (!['png', 'jpeg', 'webp'].includes(format ?? '')) {
      throw new BadRequestException('Only PNG, JPEG, or WebP images are allowed.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    const asset = await this.cloudinary.uploadBuffer(file.buffer, { folder: 'event-mgmt/avatars', resourceType: 'image' });
    let user: UserWithRole;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: asset.secureUrl },
        include: { role: true },
      });
    } catch (error) {
      await this.cloudinary.deleteByPublicId(asset.publicId, 'image', asset.deliveryType);
      throw error;
    }
    if (existing?.avatarUrl && existing.avatarUrl !== asset.secureUrl) {
      try {
        await this.cloudinary.deleteImageByUrl(existing.avatarUrl);
      } catch (error) {
        this.logger.error(
          `Unable to remove previous avatar for user ${userId}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return this.toPublicUser(user);
  }
}
