import { SetMetadata } from '@nestjs/common';
import { PermissionString } from '../permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marks a route/controller as requiring the current user to hold at least
 * one of the given permission strings (checked against AuthUser.permissions,
 * which PermissionsGuard populates from the user's Role in the database).
 *
 *   @RequirePermissions(PERMISSIONS.USERS_MANAGE)
 */
export const RequirePermissions = (...permissions: PermissionString[]) => SetMetadata(PERMISSIONS_KEY, permissions);
