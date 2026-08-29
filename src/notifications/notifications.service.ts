import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  PermissionEmailContext,
  renderAccessRevokedEmail,
  renderAccessUpdatedEmail,
  renderExistingUserAccessGrantedEmail,
  renderNewUserAccessGrantedEmail,
} from '../mail/templates/email-templates';

export type NotificationType = 'access_granted' | 'access_updated' | 'access_revoked' | 'member_removed';

export type NotifyInput = {
  userId: string;
  userEmail: string;
  userName?: string;
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventVenue?: string;
  type: NotificationType;
  title: string;
  message: string;
  inviterName?: string;
  inviterEmail?: string;
  permissions?: string[];
  isNewUser?: boolean;
  tempPassword?: string;
};

const APP_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Generates the HTML content using the static, built-in email templates
   * based on notification type and recipient state. These designs are
   * fixed in code (not editable via the database/Super Admin) — see
   * mail/templates/email-templates.ts. */
  private generateEmailHtml(input: NotifyInput, ctaHref: string): string {
    const loginHref = `${APP_URL}/signin`;
    const recipientName = input.userName || input.userEmail.split('@')[0];

    const context: PermissionEmailContext = {
      recipientName,
      recipientEmail: input.userEmail,
      inviterName: input.inviterName,
      inviterEmail: input.inviterEmail,
      eventTitle: input.eventTitle || 'Event',
      eventDate: input.eventDate,
      eventVenue: input.eventVenue,
      permissions: input.permissions || [],
      tempPassword: input.tempPassword,
      ctaHref,
      loginHref,
    };

    switch (input.type) {
      case 'access_granted':
        if (input.isNewUser) {
          return renderNewUserAccessGrantedEmail(context);
        }
        return renderExistingUserAccessGrantedEmail(context);

      case 'access_updated':
        return renderAccessUpdatedEmail(context);

      case 'access_revoked':
      case 'member_removed':
        return renderAccessRevokedEmail(context);

      default:
        return renderExistingUserAccessGrantedEmail(context);
    }
  }

  /** Creates the in-app notification row and fires the corresponding
   * "access shared / changed / revoked" email in parallel. Used by
   * EventPermissionsService whenever sharing is granted, changed, or
   * revoked for View, Attendee Management, or Edit access. A mail failure
   * never blocks the in-app notification or the underlying action. */
  async notify(input: NotifyInput) {
    const ctaHref = input.eventId ? `${APP_URL}/dashboard/events/${input.eventId}` : `${APP_URL}/dashboard`;

    const subject = input.title;
    const htmlContent = this.generateEmailHtml(input, ctaHref);

    const [notification] = await Promise.all([
      this.prisma.notification.create({
        data: {
          userId: input.userId,
          eventId: input.eventId,
          type: input.type,
          title: input.title,
          message: input.message,
        },
      }),
      this.mail.sendMail(input.userEmail, subject, htmlContent),
    ]);
    return notification;
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { success: true };
  }
}
