import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Booking } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { renderTicketEmail } from '../mail/templates/email-templates';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

export type RestrictedBooking = {
  id: string;
  name: string;
  phone: string;
  email: string;
  paymentStatus: string;
  paymentMethod: string;
  checkedIn: boolean;
};

function generateTransactionId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TXN-${stamp}-${rand}`;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async sendTicketEmail(
    booking: { id: string; name: string; email: string; phone?: string; seats: number; paymentStatus: string; paymentMethod: string; transactionId?: string | null },
    event: { id: string; title: string; date?: string; time?: string; venue?: string; slug?: string | null },
  ) {
    const appUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
    const ctaHref = event.slug ? `${appUrl}/events/${event.slug}` : `${appUrl}/dashboard`;
    const subject = `Your Admission Ticket for "${event.title}" 🎟️`;
    const html = renderTicketEmail({
      attendeeName: booking.name,
      attendeeEmail: booking.email,
      attendeePhone: booking.phone,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventVenue: event.venue,
      seats: booking.seats,
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      transactionId: booking.transactionId,
      ctaHref,
    });
    await this.mail.sendMail(booking.email, subject, html);
  }

  private async findBookableEvent(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: 'published' },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!event) throw new NotFoundException('This event is not open for booking.');
    return event;
  }

  private validateResponses(event: { fields: { name: string; label: string; type: string; required: boolean; options: string[] }[] }, responses: Record<string, unknown>) {
    for (const field of event.fields) {
      const value = responses?.[field.name];
      const isEmpty = value === undefined || value === null || value === '';

      if (field.required && field.type !== 'checkbox' && isEmpty) {
        throw new BadRequestException(`"${field.label}" is required.`);
      }
      if (field.required && field.type === 'checkbox' && value !== true) {
        throw new BadRequestException(`"${field.label}" must be confirmed.`);
      }
      if ((field.type === 'select' || field.type === 'radio') && !isEmpty && !field.options.includes(String(value))) {
        throw new BadRequestException(`"${field.label}" must be one of the listed options.`);
      }
    }
  }

  /** Step 1 of checkout: places the order. Free events settle immediately
   * (and reserve the seat right away); priced events are recorded as a
   * 'pending' order and only reserve their seat once payBooking() confirms
   * the (simulated) charge — mirroring a real e-commerce checkout. */
  async createBooking(slug: string, dto: CreateBookingDto, userId?: string | null) {
    const event = await this.findBookableEvent(slug);
    const seats = 1;

    if (event.capacity > 0 && event.attendees + seats > event.capacity) {
      throw new BadRequestException('Not enough seats left for this event.');
    }

    this.validateResponses(event, dto.responses ?? {});

    const amount = Math.max(0, event.price) * seats;
    const isFree = amount <= 0;
    const isOffline = !isFree && dto.paymentMethod === 'offline';

    const data = {
      eventId: event.id,
      userId: userId ?? null,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() ?? '',
      seats,
      responses: (dto.responses ?? {}) as object,
      amount,
      paymentMethod: isFree ? 'free' : isOffline ? 'offline' : 'razorpay',
      paymentStatus: isFree ? ('paid' as const) : ('pending' as const),
      transactionId: isFree ? generateTransactionId() : null,
      paidAt: isFree ? new Date() : null,
    };

    if (isFree || isOffline) {
      const [booking] = await this.prisma.$transaction([
        this.prisma.booking.create({ data }),
        this.prisma.event.update({
          where: { id: event.id },
          data: {
            attendees: { increment: seats },
            ...(event.capacity > 0 && event.attendees + seats >= event.capacity ? { status: 'sold-out' } : {}),
          },
        }),
      ]);
      await this.sendTicketEmail(booking, event);
      return booking;
    }

    // Priced order: created as 'pending' — no seats are reserved until
    // payBooking() confirms the charge.
    const booking = await this.prisma.booking.create({ data });
    await this.sendTicketEmail(booking, event);
    return booking;
  }

  /** Step 2 of checkout: the (simulated) payment gateway callback. Confirms
   * the charge, reserves the seat, and stamps a transaction id/receipt. */
  async payBooking(bookingId: string, paymentMethod?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { event: true },
    });
    if (!booking) throw new NotFoundException('Booking not found.');

    if (booking.paymentStatus === 'paid') return booking; // idempotent — already confirmed

    if (booking.paymentStatus !== 'pending') {
      throw new BadRequestException('This order can no longer be paid for.');
    }

    if (booking.event.capacity > 0 && booking.event.attendees + booking.seats > booking.event.capacity) {
      await this.prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'failed' } });
      throw new BadRequestException('Seats sold out while payment was processing — nothing was charged.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'paid',
          paymentMethod: paymentMethod ?? booking.paymentMethod,
          transactionId: generateTransactionId(),
          paidAt: new Date(),
        },
      }),
      this.prisma.event.update({
        where: { id: booking.event.id },
        data: {
          attendees: { increment: booking.seats },
          ...(booking.event.capacity > 0 && booking.event.attendees + booking.seats >= booking.event.capacity
            ? { status: 'sold-out' }
            : {}),
        },
      }),
    ]);

    await this.sendTicketEmail(updated, booking.event);
    return updated;
  }

  async myBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { event: true },
    });
  }

  /** Roster for one event — access already verified by EventAccessGuard.
   * `restricted` is true for a member whose ONLY capability on this event
   * is ATTENDEE (no EDIT, not the owner, not Super Admin) — per spec they
   * may only see the fields needed to manage check-in at the door: name,
   * mobile, email, paid status, check-in state, and payment mode. Custom
   * registration-form answers, seat counts, amounts, and transaction ids
   * are never sent to a restricted caller, not just hidden in the UI. */
  async eventBookings(eventId: string, restricted?: false): Promise<Booking[]>;
  async eventBookings(eventId: string, restricted: true): Promise<RestrictedBooking[]>;
  async eventBookings(eventId: string, restricted: boolean): Promise<Booking[] | RestrictedBooking[]>;
  async eventBookings(eventId: string, restricted = false): Promise<Booking[] | RestrictedBooking[]> {
    if (restricted) {
      return this.prisma.booking.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          paymentStatus: true,
          paymentMethod: true,
          checkedIn: true,
        },
      });
    }
    return this.prisma.booking.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Attendee Management capability: toggles a single attendee's check-in
   * state at the door. */
  async toggleCheckIn(eventId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, eventId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { checkedIn: !booking.checkedIn, checkedInAt: !booking.checkedIn ? new Date() : null },
    });
  }

  /** Attendee Management capability: approve or reject a registration. */
  async updateRegistrationStatus(eventId: string, bookingId: string, dto: UpdateRegistrationStatusDto) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, eventId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { registrationStatus: dto.status },
    });
  }

  /** Attendee Management capability: export the attendee list as CSV. A
   * restricted (ATTENDEE-only) caller gets only the six fields they're
   * allowed to see anywhere else in the product. */
  async exportRoster(eventId: string, restricted = false): Promise<string> {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    if (restricted) {
      const bookings = await this.eventBookings(eventId, true);
      const header = ['Name', 'Mobile', 'Email', 'Paid Status', 'Check In', 'Payment Mode'];
      const rows = bookings.map((b) =>
        [b.name, b.phone, b.email, b.paymentStatus, b.checkedIn ? 'Yes' : 'No', b.paymentMethod].map(escape).join(','),
      );
      return [header.map(escape).join(','), ...rows].join('\n');
    }

    const bookings = await this.eventBookings(eventId, false);
    const header = ['Name', 'Email', 'Phone', 'Seats', 'Registration status', 'Payment status', 'Checked in', 'Booked at'];
    const rows = bookings.map((b) =>
      [
        b.name,
        b.email,
        b.phone,
        String(b.seats),
        b.registrationStatus,
        b.paymentStatus,
        b.checkedIn ? 'Yes' : 'No',
        b.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    return [header.map(escape).join(','), ...rows].join('\n');
  }
}
