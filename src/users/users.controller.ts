import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/permissions';
import { UsersService } from './users.service';
import { AssignRoleDto } from '../roles/dto/assign-role.dto';
import { RolesService } from '../roles/roles.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { CreateUserDto } from './dto/create-user.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard, SuperAdminGuard)
@RequirePermissions(PERMISSIONS.USERS_MANAGE)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Post('organizers')
  createOrganizer(@Body() dto: CreateOrganizerDto) {
    return this.usersService.createOrganizer(dto);
  }

  @Patch(':id/role')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.assignToUser(id, dto, user.id);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.deleteUser(id, user.id);
  }
}
