import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { SYSTEM_ROLES } from '../common/permissions';
import { QrCodeDto } from './qr-codes.dto';
@Injectable()
export class QrCodesService {
 constructor(private readonly prisma: PrismaService) {}
 private scope(user: AuthUser) { return user.roleName === SYSTEM_ROLES.SUPER_ADMIN ? {} : { ownerId: user.id }; }
 list(user: AuthUser) { return this.prisma.qrCode.findMany({ where: this.scope(user), include: { owner: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }); }
 create(user: AuthUser, dto: QrCodeDto) { return this.prisma.qrCode.create({ data: { title: dto.title.trim(), url: dto.url.trim(), ownerId: user.id } }); }
 async update(user: AuthUser, id: string, dto: QrCodeDto) {
  const result = await this.prisma.qrCode.updateMany({ where: { id, ...this.scope(user) }, data: { title: dto.title.trim(), url: dto.url.trim() } });
  if (!result.count) throw new NotFoundException('QR code not found.');
  return { success: true };
 }
 async remove(user: AuthUser, id: string) {
  const result = await this.prisma.qrCode.deleteMany({ where: { id, ...this.scope(user) } });
  if (!result.count) throw new NotFoundException('QR code not found.');
  return { success: true };
 }
}
