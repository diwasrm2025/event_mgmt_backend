import { Module, Controller, UseGuards, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaModule } from '../prisma/prisma.module';
import { QrCodesService } from './qr-codes.service';
import { QrCodeDto } from './qr-codes.dto';
@Controller('qr-codes') @UseGuards(JwtAuthGuard)
export class QrCodesController {
 constructor(private readonly service: QrCodesService) {}
 @Get() list(@CurrentUser() user: AuthUser) { return this.service.list(user); }
 @Post() create(@CurrentUser() user: AuthUser, @Body() dto: QrCodeDto) { return this.service.create(user, dto); }
 @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: QrCodeDto) { return this.service.update(user, id, dto); }
 @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
@Module({ imports: [PrismaModule], controllers: [QrCodesController], providers: [QrCodesService] })
export class QrCodesModule {}
