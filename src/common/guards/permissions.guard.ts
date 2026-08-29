import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { PermissionString } from '../permissions';

/**
 * Must run AFTER JwtAuthGuard (so request.user is populated). Denies access
 * unless the user holds at least one of the permissions declared via
 * @RequirePermissions(...) on the handler or controller. Routes with no
 * declared permissions are allowed through (authentication alone is
 * sufficient) — this guard only ever adds restrictions, never grants access.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionString[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Authentication is required.');

    const hasPermission = required.some((permission) => user.permissions.includes(permission));
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
