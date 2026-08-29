import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The authenticated user, resolved fresh from the database on every request
 * by JwtStrategy (not just decoded from the JWT). This guarantees a role
 * change or permission grant takes effect on the user's very next request,
 * without needing to wait for token expiry or force a re-login.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
