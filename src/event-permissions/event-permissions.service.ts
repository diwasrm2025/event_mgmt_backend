import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { EVENT_PERMISSION, GRANT_STATUS, PERMISSIONS } from '../common/permissions';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { NotificationsService } from '../notifications/notifications.service';

const PERMISSION_LABELS: Record<string, string> = {
  [EVENT_PERMISSION.VIEW]: 'View',
  [EVENT_PERMISSION.ATTENDEE]: 'Attendee Management',
  [EVENT_PERMISSION.EDIT]: 'Edit',
  [EVENT_PERMISSION.PAYMENT_APPROVE]: 'Payment Approve',
};

function describePermissions(permissions: string[]) {
  return permissions.map((p) => PERMISSION_LABELS[p] || p).join(', ');
}

@Injectable()
export class EventPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Only the owner or a Super Admin may view/manage who an event is
   * shared with — this is a distinct, stricter capability than having
   * EDIT or ATTENDEE access to the event's content. */
  private async assertCanManage(eventId: string, user: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    const isSuperAdmin = user.permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL);
    if (!isSuperAdmin && event.ownerId !== user.id) {
      throw new ForbiddenException('Only the event owner or a Super Admin can manage sharing for this event.');
    }
    return event;
  }

  private readonly memberSelect = {
    id: true,
    permissions: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    grantedBy: { select: { id: true, name: true, email: true } },
  } as const;

  /** The full Shared Members list — active AND previously-removed rows, so
   * the "Status: Active/Removed" column in the spec has something to show.
   * The live "Shared Members (N)" count only ever counts ACTIVE rows;
   * see sharedMembersCount(). */
  async list(eventId: string, user: AuthUser) {
    await this.assertCanManage(eventId, user);
    return this.prisma.eventPermission.findMany({
      where: { eventId },
      select: this.memberSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async sharedMembersCount(eventId: string) {
    return this.prisma.eventPermission.count({ where: { eventId, status: GRANT_STATUS.ACTIVE } });
  }

  private async resolveTargetUser(dto: GrantPermissionDto) {
    const user = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : await this.prisma.user.findUnique({ where: { email: dto.email!.toLowerCase().trim() } });
    if (!user) {
      throw new NotFoundException(
        dto.userId ? 'User not found.' : 'No registered user was found with that email address.',
      );
    }
    return user;
  }

  async grant(
    eventId: string,
    dto: GrantPermissionDto,
    actingUser: AuthUser,
    extraMeta?: { isNewUser?: boolean; tempPassword?: string },
  ) {
    const event = await this.assertCanManage(eventId, actingUser);
    const target = await this.resolveTargetUser(dto);

    if (target.id === event.ownerId) {
      throw new BadRequestException('The event owner already has full access — no grant needed.');
    }

    const existing = await this.prisma.eventPermission.findUnique({
      where: { eventId_userId: { eventId, userId: target.id } },
    });

    const grant = await this.prisma.eventPermission.upsert({
      where: { eventId_userId: { eventId, userId: target.id } },
      update: { permissions: dto.permissions, status: GRANT_STATUS.ACTIVE, grantedById: actingUser.id },
      create: { eventId, userId: target.id, permissions: dto.permissions, grantedById: actingUser.id },
      select: this.memberSelect,
    });

    const isNewOrWasRemoved = !existing || existing.status !== GRANT_STATUS.ACTIVE;
    await this.notifications.notify({
      userId: target.id,
      userEmail: target.email,
      userName: target.name,
      eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue,
      type: isNewOrWasRemoved ? 'access_granted' : 'access_updated',
      title: isNewOrWasRemoved ? `You've been given access to "${event.title}"` : `Your access to "${event.title}" was updated`,
      message: `${actingUser.name} ${isNewOrWasRemoved ? 'shared' : 'updated your access to'} "${event.title}" with you. Permissions: ${describePermissions(
        dto.permissions,
      )}.`,
      inviterName: actingUser.name,
      inviterEmail: actingUser.email,
      permissions: dto.permissions,
      isNewUser: extraMeta?.isNewUser || false,
      tempPassword: extraMeta?.tempPassword,
    });

    return grant;
  }

  async createUserAndGrant(
    eventId: string,
    dto: { name: string; email: string; password?: string; permissions: string[] },
    actingUser: AuthUser,
  ) {
    const event = await this.assertCanManage(eventId, actingUser);
    const email = dto.email.toLowerCase().trim();
    let target = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    const rawPassword = dto.password?.trim() || 'Password123!';

    if (!target) {
      isNewUser = true;
      let organizerRole = await this.prisma.role.findFirst({ where: { name: 'ORGANIZER' } });
      if (!organizerRole) {
        organizerRole = await this.prisma.role.findFirst();
      }
      if (!organizerRole) {
        organizerRole = await this.prisma.role.create({
          data: {
            name: 'ORGANIZER',
            description: 'Organizer role',
            permissions: ['events:create'],
            isSystem: true,
          },
        });
      }
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      target = await this.prisma.user.create({
        data: {
          name: dto.name?.trim() || email.split('@')[0],
          email,
          password: passwordHash,
          roleId: organizerRole.id,
        },
      });
    }

    return this.grant(
      eventId,
      { userId: target.id, permissions: dto.permissions },
      actingUser,
      isNewUser ? { isNewUser: true, tempPassword: rawPassword } : undefined,
    );
  }

  async update(eventId: string, permissionId: string, dto: UpdatePermissionDto, actingUser: AuthUser) {
    const event = await this.assertCanManage(eventId, actingUser);
    const existing = await this.prisma.eventPermission.findFirst({ where: { id: permissionId, eventId } });
    if (!existing) throw new NotFoundException('Shared member not found.');

    const grant = await this.prisma.eventPermission.update({
      where: { id: permissionId },
      data: { permissions: dto.permissions, status: GRANT_STATUS.ACTIVE },
      select: this.memberSelect,
    });

    await this.notifications.notify({
      userId: grant.user.id,
      userEmail: grant.user.email,
      userName: grant.user.name,
      eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue,
      type: 'access_updated',
      title: `Your access to "${event.title}" was updated`,
      message: `${actingUser.name} updated your permissions on "${event.title}". You now have: ${describePermissions(dto.permissions)}.`,
      inviterName: actingUser.name,
      inviterEmail: actingUser.email,
      permissions: dto.permissions,
    });

    return grant;
  }

  /** "Revoke Access" — clears permissions and marks the row REMOVED but
   * keeps it for the Shared Members history/audit trail. */
  async revoke(eventId: string, permissionId: string, actingUser: AuthUser) {
    const event = await this.assertCanManage(eventId, actingUser);
    const existing = await this.prisma.eventPermission.findFirst({
      where: { id: permissionId, eventId },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Shared member not found.');

    const grant = await this.prisma.eventPermission.update({
      where: { id: permissionId },
      data: { status: GRANT_STATUS.REMOVED, permissions: [] },
      select: this.memberSelect,
    });

    await this.notifications.notify({
      userId: existing.user.id,
      userEmail: existing.user.email,
      userName: existing.user.name,
      eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue,
      type: 'access_revoked',
      title: `Your access to "${event.title}" was removed`,
      message: `${actingUser.name} revoked your access to "${event.title}". You no longer have any permissions on this event.`,
      inviterName: actingUser.name,
      inviterEmail: actingUser.email,
    });

    return grant;
  }

  /** "Remove Member" — deletes the row entirely (no history kept). */
  async removeMember(eventId: string, permissionId: string, actingUser: AuthUser) {
    const event = await this.assertCanManage(eventId, actingUser);
    const existing = await this.prisma.eventPermission.findFirst({
      where: { id: permissionId, eventId },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Shared member not found.');

    await this.prisma.eventPermission.delete({ where: { id: permissionId } });

    await this.notifications.notify({
      userId: existing.user.id,
      userEmail: existing.user.email,
      userName: existing.user.name,
      eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue,
      type: 'member_removed',
      title: `You were removed from "${event.title}"`,
      message: `${actingUser.name} removed you from the shared members list for "${event.title}".`,
      inviterName: actingUser.name,
      inviterEmail: actingUser.email,
    });

    return { success: true };
  }
}
