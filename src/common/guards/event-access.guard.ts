import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { EVENT_ACCESS_KEY } from '../decorators/event-access.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { EVENT_PERMISSION, EventPermissionValue, GRANT_STATUS, PERMISSIONS } from '../permissions';

/** EDIT, PAYMENT_APPROVE and ATTENDEE each imply the ability to view the event — a shared
 * Editor or Attendee Manager doesn't also need a separate VIEW grant to do
 * their job. EDIT does not imply ATTENDEE and vice versa (per spec: an
 * Editor cannot manage attendees, and an Attendee Manager cannot edit). */
function grantSatisfies(permissions: string[], required: EventPermissionValue): boolean {
  if (permissions.includes(required)) return true;
  if (required === EVENT_PERMISSION.VIEW) {
    return permissions.includes(EVENT_PERMISSION.EDIT) || permissions.includes(EVENT_PERMISSION.ATTENDEE) || permissions.includes(EVENT_PERMISSION.PAYMENT_APPROVE);
  }
  return false;
}

/**
 * Enforces per-event authorization. Must run after JwtAuthGuard. Access is
 * granted, in order, if the user:
 *   1. holds the global `events:manage_all` permission (Super Admin), or
 *   2. is the event's owner (Event.ownerId), or
 *   3. has an ACTIVE EventPermission grant for this event whose
 *      `permissions` array satisfies the route's required capability.
 * Everyone else gets a 403.
 *
 * Attaches the resolved event to `request.event`, and the effective grant
 * (if any) to `request.eventGrant`, so downstream services don't need to
 * re-fetch either.
 */
@Injectable()
export class EventAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ capability: EventPermissionValue; paramName: string } | undefined>(
      EVENT_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Authentication is required.');

    const eventId = request.params?.[meta.paramName];
    if (!eventId) throw new NotFoundException('Event not found.');

    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    if (user.permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL)) {
      request.event = event;
      request.eventGrant = 'MANAGE_ALL';
      return true;
    }

    if (event.ownerId === user.id) {
      request.event = event;
      request.eventGrant = 'OWNER';
      return true;
    }

    const grant = await this.prisma.eventPermission.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
    });

    if (!grant || grant.status !== GRANT_STATUS.ACTIVE || !grantSatisfies(grant.permissions, meta.capability)) {
      throw new ForbiddenException('You do not have access to this event.');
    }

    request.event = event;
    request.eventGrant = grant;
    return true;
  }
}
