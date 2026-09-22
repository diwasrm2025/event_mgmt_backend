import { Body, Controller, Get, Header, Param, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { RequireEventAccess } from '../common/decorators/event-access.decorator';
import { EVENT_PERMISSION } from '../common/permissions';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

export function rosterCapabilities(grant: unknown) {
  const all = grant === 'OWNER' || grant === 'MANAGE_ALL';
  const permissions = grant && typeof grant === 'object' ? (grant as { permissions?: string[] }).permissions ?? [] : [];
  return { canApprovePayment: all || permissions.includes(EVENT_PERMISSION.PAYMENT_APPROVE), canCheckIn: all || permissions.includes(EVENT_PERMISSION.ATTENDEE) };
}

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.bookingsService.myBookings(user.id);
  }

  /** Roster: every attendee booked for one event. Any active grant (View,
   * Attendee, or Edit) can see who registered — managing check-in/approval
   * requires a separate capability for payment review and check-in. */
  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.VIEW, 'eventId')
  @Get('event/:eventId')
  async forEvent(@Param('eventId') eventId: string, @Req() request: Request) {
    const capabilities = rosterCapabilities((request as { eventGrant?: unknown }).eventGrant);
    const items = await this.bookingsService.roster(eventId, capabilities);
    return { capabilities, items };
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.VIEW, 'eventId')
  @Get('event/:eventId/export')
  @Header('Content-Type', 'text/csv')
  async exportRoster(@Param('eventId') eventId: string, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const capabilities = rosterCapabilities((request as { eventGrant?: unknown }).eventGrant);
    const rows = await this.bookingsService.roster(eventId, capabilities);
    const fields = ['name', 'email', 'phone', 'paymentStatus', ...(capabilities.canApprovePayment ? ['transactionId', 'rejectionReason'] : []), ...(capabilities.canCheckIn ? ['checkedIn'] : [])];
    const escape = (value: unknown) => '"' + String(value ?? '').replace(/^[=+@-]/, match => "'" + match).replace(/"/g, '""') + '"';
    const csv = [fields.join(','), ...rows.map(row => fields.map(field => escape((row as Record<string, unknown>)[field])).join(','))].join('\n');
    res.set('Content-Disposition', `attachment; filename="attendees-${eventId}.csv"`);
    return csv;
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.ATTENDEE, 'eventId')
  @Patch('event/:eventId/:bookingId/check-in')
  toggleCheckIn(@Param('eventId') eventId: string, @Param('bookingId') bookingId: string) {
    return this.bookingsService.toggleCheckIn(eventId, bookingId);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.PAYMENT_APPROVE, 'eventId')
  @Patch('event/:eventId/:bookingId/registration-status')
  updateRegistrationStatus(
    @Param('eventId') eventId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateRegistrationStatusDto,
    @Req() request: Request,
  ) {
    return this.bookingsService.updateRegistrationStatus(eventId, bookingId, dto).then(booking => ({
      id: booking.id, paymentStatus: booking.paymentStatus, registrationStatus: booking.registrationStatus,
      rejectionReason: booking.rejectionReason, paidAt: booking.paidAt, status: booking.status,
    }));
  }
}
