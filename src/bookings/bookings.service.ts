import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { renderTicketEmail } from '../mail/templates/email-templates';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';

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
    const subject = `Thank you for registering - ${event.title}`;
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

  /** Paid registrations await administrator review of the supplied evidence. */
  async createBooking(slug: string, dto: CreateBookingDto, userId?: string | null) {
    const event = await this.findBookableEvent(slug);
    this.validateResponses(event, dto.responses ?? {});
    const isFree = event.price <= 0;
    const transactionId = dto.transactionId?.trim().toUpperCase();
    if (!isFree) {
      if (!transactionId || !/^[A-Z0-9-]{6,100}$/.test(transactionId)) throw new BadRequestException('Enter a valid transaction ID (6?100 letters, digits or hyphens).');
      const match = dto.paymentProof?.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) throw new BadRequestException('Attach a PNG, JPEG or WebP payment screenshot.');
      const bytes = Buffer.from(match[2], 'base64');
      const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid || bytes.length > 5 * 1024 * 1024) throw new BadRequestException('Use a valid screenshot up to 5 MB.');
    }
    const booking = await this.prisma.$transaction(async (tx) => {
      const current = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
      if (current.capacity > 0 && current.attendees >= current.capacity) throw new BadRequestException('This event is sold out.');
      if (transactionId && await tx.booking.findFirst({ where: { paymentMethod: 'qr', transactionId } })) throw new BadRequestException('This transaction ID has already been submitted.');
      const created = await tx.booking.create({ data: {
        eventId: event.id, userId: userId ?? null, name: dto.name.trim(), email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() ?? '', seats: 1, responses: (dto.responses ?? {}) as object,
        amount: Math.max(0, event.price), paymentMethod: isFree ? 'free' : 'qr',
        paymentStatus: isFree ? 'paid' : 'pending', status: isFree ? 'confirmed' : 'pending',
        registrationStatus: isFree ? 'approved' : 'pending',
        transactionId: isFree ? generateTransactionId() : transactionId,
        paymentProof: isFree ? null : dto.paymentProof, paidAt: isFree ? new Date() : null,
      } });
      if (isFree) await tx.event.update({ where: { id: event.id }, data: {
        attendees: { increment: 1 }, ...(current.capacity > 0 && current.attendees + 1 >= current.capacity ? { status: 'sold-out' } : {}),
      } });
      return created;
    }, { isolationLevel: 'Serializable' });
    if (isFree) await this.sendTicketEmail(booking, event);
    return booking;
  }

  async paymentStatus(bookingId: string, token: string) {
    if (!token) throw new NotFoundException('Booking not found.');
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, paymentAccessToken: token },
      select: { paymentStatus: true, registrationStatus: true, paidAt: true, status: true, rejectionReason: true },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  async roster(eventId: string, access: { canApprovePayment: boolean; canCheckIn: boolean }) {
    return this.prisma.booking.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, select: {
      id: true, name: true, email: true, phone: true, seats: true, amount: true, createdAt: true,
      paymentMethod: true, paymentStatus: true, registrationStatus: true, status: true, responses: true,
      ...(access.canApprovePayment ? { paymentProof: true, transactionId: true, rejectionReason: true, paidAt: true } : {}),
      ...(access.canCheckIn ? { checkedIn: true, checkedInAt: true } : {}),
    } });
  }

  async myBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { event: true },
    });
  }

  /** Attendee Management capability: toggles a single attendee's check-in
   * state at the door. */
  async toggleCheckIn(eventId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, eventId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    if (booking.paymentStatus !== 'paid' || booking.registrationStatus !== 'approved') throw new BadRequestException('Approve payment before check-in.');
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { checkedIn: !booking.checkedIn, checkedInAt: !booking.checkedIn ? new Date() : null },
      select: { id: true, checkedIn: true, checkedInAt: true },
    });
  }

  /** Attendee Management capability: approve or reject a registration. */
  async updateRegistrationStatus(eventId: string, bookingId: string, dto: UpdateRegistrationStatusDto) {
    if (dto.status === 'rejected' && !dto.reason?.trim()) throw new BadRequestException('A reason is required when rejecting payment.');
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, eventId }, include: { event: true } });
      if (!booking) throw new NotFoundException('Booking not found.');
      if (booking.paymentStatus === 'paid') {
        if (dto.status !== 'approved') throw new BadRequestException('Completed payments cannot be changed through registration review.');
        return { booking, notify: false };
      }
      if (dto.status === 'approved') {
        if (!booking.transactionId || !booking.paymentProof) throw new BadRequestException('Transaction ID and payment proof are required before approval.');
        const event = booking.event;
        if (event.capacity > 0 && event.attendees + booking.seats > event.capacity) throw new BadRequestException('No seats remain. Resolve the payment with the attendee before approving.');
        await tx.event.update({ where: { id: eventId }, data: {
          attendees: { increment: booking.seats },
          ...(event.capacity > 0 && event.attendees + booking.seats >= event.capacity ? { status: 'sold-out' } : {}),
        } });
      }
      const updated = await tx.booking.update({ where: { id: bookingId }, data: {
        registrationStatus: dto.status,
        rejectionReason: dto.status === 'rejected' ? dto.reason!.trim() : null,
        status: dto.status === 'approved' ? 'confirmed' : dto.status === 'rejected' ? 'cancelled' : 'pending',
        paymentStatus: dto.status === 'approved' ? 'paid' : dto.status === 'rejected' ? 'failed' : 'pending',
        ...(dto.status === 'approved' ? { paidAt: new Date() } : {}),
      }, include: { event: true } });
      return { booking: updated, notify: dto.status === 'approved' };
    }, { isolationLevel: 'Serializable' });
    if (result.notify) await this.sendTicketEmail(result.booking, result.booking.event);
    return result.booking;
  }

}
