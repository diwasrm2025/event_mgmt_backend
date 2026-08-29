import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { EventPermissionsService } from './event-permissions.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@UseGuards(JwtAuthGuard)
@Controller('events/:eventId/permissions')
export class EventPermissionsController {
  constructor(private readonly service: EventPermissionsService) {}

  /** Full Shared Members list (active + removed, for history). */
  @Get()
  list(@Param('eventId') eventId: string, @CurrentUser() user: AuthUser) {
    return this.service.list(eventId, user);
  }

  /** Live "Shared Members (N)" count — ACTIVE grants only. */
  @Get('count')
  count(@Param('eventId') eventId: string) {
    return this.service.sharedMembersCount(eventId);
  }

  @Post()
  grant(@Param('eventId') eventId: string, @Body() dto: GrantPermissionDto, @CurrentUser() user: AuthUser) {
    return this.service.grant(eventId, dto, user);
  }

  @Post('create-user')
  createUserAndGrant(
    @Param('eventId') eventId: string,
    @Body() dto: { name: string; email: string; password: string; permissions: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createUserAndGrant(eventId, dto, user);
  }

  @Patch(':permissionId')
  update(
    @Param('eventId') eventId: string,
    @Param('permissionId') permissionId: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(eventId, permissionId, dto, user);
  }

  /** "Revoke Access" — clears permissions, keeps the row as history. */
  @Patch(':permissionId/revoke')
  revoke(@Param('eventId') eventId: string, @Param('permissionId') permissionId: string, @CurrentUser() user: AuthUser) {
    return this.service.revoke(eventId, permissionId, user);
  }

  /** "Remove Member" — deletes the row outright. */
  @Delete(':permissionId')
  remove(@Param('eventId') eventId: string, @Param('permissionId') permissionId: string, @CurrentUser() user: AuthUser) {
    return this.service.removeMember(eventId, permissionId, user);
  }
}
