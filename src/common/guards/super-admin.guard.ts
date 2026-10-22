import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../decorators/current-user.decorator';
import { SYSTEM_ROLES } from '../permissions';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (user?.roleName !== SYSTEM_ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can manage platform users and roles.');
    }
    return true;
  }
}
