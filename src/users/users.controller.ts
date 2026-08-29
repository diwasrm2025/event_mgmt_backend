import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/permissions';
import { UsersService } from './users.service';
import { AssignRoleDto } from '../roles/dto/assign-role.dto';
import { RolesService } from '../roles/roles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Patch(':id/role')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.assignToUser(id, dto, user.id);
  }
}
