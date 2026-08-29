import { Body, Controller, Get, Header, Param, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { RequireEventAccess } from '../common/decorators/event-access.decorator';
import { EVENT_PERMISSION } from '../common/permissions';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

/** True when the caller's only access to this event is a shared ATTENDEE
 * grant — not the owner, not Super Admin, and not also holding EDIT. Read
 * off `request.eventGrant`, which EventAccessGuard attaches for every
 * request that passes through it. */
function isAttendeeOnlyGrant(eventGrant: unknown): boolean {
  if (eventGrant === 'MANAGE_ALL' || eventGrant === 'OWNER') return false;
  if (!eventGrant || typeof eventGrant !== 'object') return false;
  const permissions = (eventGrant as { permissions?: string[] }).permissions ?? [];
  return !permissions.includes(EVENT_PERMISSION.EDIT);
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
   * requires the ATTENDEE capability specifically, enforced per-action below. */
  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.VIEW, 'eventId')
  @Get('event/:eventId')
  async forEvent(@Param('eventId') eventId: string, @Req() request: Request) {
    const restricted = isAttendeeOnlyGrant((request as { eventGrant?: unknown }).eventGrant);
    const items = await this.bookingsService.eventBookings(eventId, restricted);
    return { restricted, items };
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.ATTENDEE, 'eventId')
  @Get('event/:eventId/export')
  @Header('Content-Type', 'text/csv')
  async exportRoster(@Param('eventId') eventId: string, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const restricted = isAttendeeOnlyGrant((request as { eventGrant?: unknown }).eventGrant);
    const csv = await this.bookingsService.exportRoster(eventId, restricted);
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
  @RequireEventAccess(EVENT_PERMISSION.ATTENDEE, 'eventId')
  @Patch('event/:eventId/:bookingId/registration-status')
  updateRegistrationStatus(
    @Param('eventId') eventId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.bookingsService.updateRegistrationStatus(eventId, bookingId, dto);
  }
}
