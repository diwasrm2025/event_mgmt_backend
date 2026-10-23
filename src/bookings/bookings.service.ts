import { ageThisYear, isDobField } from './registration';
import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { renderTicketEmail } from '../mail/templates/email-templates';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { SbiepayService } from '../sbiepay/sbiepay.service';
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sbiepay: SbiepayService,
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
    if (event.registrationDeadline && event.registrationDeadline.getTime() <= Date.now()) throw new BadRequestException('Event registration has been closed.');
    return event;
  }

  private validateResponses(event: { fields: { name: string; label: string; type: string; required: boolean; options: string[] }[] }, responses: Record<string, unknown>) {
    for (const field of event.fields) {
      const value = responses?.[field.name];
      if (isDobField(field) && value && ageThisYear(value) === null) throw new BadRequestException('Enter a valid date of birth that is not in the future.');
      const isEmpty = value === undefined || value === null || value === '';

      if (field.type === 'checkbox' && value !== undefined && typeof value !== 'boolean') {
        throw new BadRequestException(`"${field.label}" must be a checkbox value.`);
      }
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

  /** Paid registrations are settled only by SBI Order Search. */
  async createBooking(slug: string, dto: CreateBookingDto, userId?: string | null) {
    
    const event = await this.findBookableEvent(slug);
    const isFree = event.eventType === 'free' || (!event.eventType && event.price <= 0);
    if (isFree && dto.paymentMethod) {
      throw new BadRequestException('Free event registrations do not accept payment details.');
    }
    this.validateResponses(event, dto.responses ?? {});
    if (!isFree && event.price <= 0) {
      throw new BadRequestException('This paid event does not have a valid ticket price.');
    }
    if (dto.paymentMethod && dto.paymentMethod !== 'sbiepay') throw new BadRequestException('Only SBI ePay is supported for paid registrations.');
    // Reject unavailable checkout before creating a pending order.
    if (!isFree) this.sbiepay.assertConfigured();
    const merchantOrderNumber = isFree ? null : 'O' + randomUUID().replace(/-/g, '');
    const booking = await this.prisma.$transaction(async (tx) => {
      const current = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
      if (current.status !== 'published' || (current.registrationDeadline && current.registrationDeadline.getTime() <= Date.now())) throw new BadRequestException('Event registration has been closed.');
      if (current.capacity > 0 && current.attendees >= current.capacity) throw new BadRequestException('This event is sold out.');
      const created = await tx.booking.create({ data: {
        eventId: event.id, userId: userId ?? null, name: dto.name.trim(), email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() ?? '', seats: 1, responses: (dto.responses ?? {}) as object,
        amount: Math.max(0, event.price), 
        paymentMethod: isFree ? 'free' : 'sbiepay',
        merchantOrderNumber,
        orderStatus: isFree ? null : 'CREATED',
        paymentStatus: isFree ? 'paid' : 'pending',
        status: isFree ? 'confirmed' : 'pending',
        registrationStatus: isFree ? 'approved' : 'pending',
        transactionId: null,
        paymentProof: null,
        paidAt: isFree ? new Date() : null,
      } });
      if (isFree) await tx.event.update({ where: { id: event.id }, data: {
        attendees: { increment: 1 }, ...(current.capacity > 0 && current.attendees + 1 >= current.capacity ? { status: 'sold-out' } : {}),
      } });
      return created;
    }, { isolationLevel: 'Serializable' });
    if (isFree) {
      await this.sendTicketEmail(booking, event);
      return booking;
    }

    // Persist the merchant reference before contacting SBI so uncertain create responses can be searched.
    try {
      const orderResponse = await this.sbiepay.createOrder({
        currencyCode: 'INR', orderAmount: booking.amount,
        orderRefNumber: merchantOrderNumber,
        returnUrl: (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '') + '/api/bookings/sbiepay/callback',
      });
      const order = orderResponse.data?.[0];
      if (order?.sbiOrderRefNumber) await this.prisma.booking.update({ where: { id: booking.id }, data: { sbiOrderRefNumber: String(order.sbiOrderRefNumber) } });
      if (!order?.transactionUrl) throw new Error('Missing SBI checkout URL');
      return { booking, transactionUrl: order.transactionUrl };
    } catch {
      this.logger.warn('SBI order creation unresolved for booking ' + booking.id + '; scheduled verification will retry.');
      return { booking, paymentInitiationPending: true };
    }
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
      if (booking.paymentMethod === 'sbiepay') throw new BadRequestException('SBI ePay payments are verified automatically and cannot be changed manually.');
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

  async verifySbiOrder(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.paymentMethod !== 'sbiepay' || !booking.merchantOrderNumber || booking.paymentStatus !== 'pending') return;
    await this.prisma.booking.update({ where: { id: booking.id }, data: { orderLastCheckedAt: new Date() } });
    const orderSearchDetails = {
      orderAmount: booking.amount, orderRefNumber: booking.merchantOrderNumber,
      ...(booking.sbiOrderRefNumber ? { sbiOrderRefNumber: booking.sbiOrderRefNumber } : {}),
      ...(booking.atrnNumber ? { atrnNumber: booking.atrnNumber } : {}),
    };
    const response = await this.sbiepay.searchOrder(orderSearchDetails);
    // API envelope status and transaction status never decide fulfillment.
    // SBI SDK returns data: [[{ orderInfo, paymentInfo: [...] }]].
    // Also support the flat response used by earlier SDK versions.
    const rows = Array.isArray(response.data) ? response.data.flat(Infinity) : [];
    const row = rows.find((item: any) => (item?.orderInfo ?? item)?.orderRefNumber === booking.merchantOrderNumber);
    const orderInfo = row?.orderInfo ?? row;
    const payments = Array.isArray(row?.paymentInfo) ? row.paymentInfo : [];
    const payment = [...payments].reverse().find((item: any) => Number(item?.orderAmount) === booking.amount);
    const order = orderInfo ? {
      ...orderInfo,
      orderAmount: orderInfo.orderAmount ?? payment?.orderAmount,
      atrnNumber: payment?.atrnNumber ?? orderInfo.atrnNumber,
    } : null;
    if (!order || !Number.isFinite(Number(order.orderAmount)) || Number(order.orderAmount) !== booking.amount || typeof order.orderStatus !== 'string') {
      throw new Error('SBI search response did not match the stored order and amount');
    }
    const orderStatus = order.orderStatus.trim().toUpperCase();
    const success = orderStatus === 'PAID' || orderStatus === 'SUCCESS';
    const failed = orderStatus === 'FAIL' || orderStatus === 'FAILED';
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: booking.id }, include: { event: true } });
      if (!current || current.paymentStatus !== 'pending') return null;
      const hasCapacity = current.event.capacity <= 0 || current.event.attendees + current.seats <= current.event.capacity;
      const approve = success && hasCapacity;
      const updated = await tx.booking.update({ where: { id: current.id }, data: {
        orderStatus,
        ...(order.sbiOrderRefNumber ? { sbiOrderRefNumber: String(order.sbiOrderRefNumber) } : {}),
        ...(order.atrnNumber ? { atrnNumber: String(order.atrnNumber), transactionId: String(order.atrnNumber) } : {}),
        ...(success ? { paymentStatus: 'paid', paidAt: new Date(), registrationStatus: approve ? 'approved' : 'pending', status: approve ? 'confirmed' : 'pending', rejectionReason: approve ? null : 'Payment received, but no seats remain. Please contact the organizer.' } : {}),
        ...(failed ? { paymentStatus: 'failed', registrationStatus: 'rejected', status: 'cancelled', rejectionReason: 'SBI ePay reported that the order failed.' } : {}),
      }, include: { event: true } });
      if (approve) await tx.event.update({ where: { id: current.eventId }, data: {
        attendees: { increment: current.seats },
        ...(current.event.capacity > 0 && current.event.attendees + current.seats >= current.event.capacity ? { status: 'sold-out' } : {}),
      } });
      return approve ? updated : null;
    }, { isolationLevel: 'Serializable' });
    if (result) await this.sendTicketEmail(result, result.event);
  }

  async handleSbiEpayCallback(request: any, response: any) {
    const encData = request.query?.encData ?? request.body?.encData;
    if (!encData || typeof encData !== 'string') return response.status(400).send('Missing encData');
    try {
      const decoded = await this.sbiepay.decodeCallback(encData);
      const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
      const data = payload?.data ?? payload;
      const row = Array.isArray(data) ? data.flat(Infinity)[0] : data;
      const details = row?.orderInfo ?? row;
      if (typeof details?.orderRefNumber !== 'string') return response.status(400).send('Missing merchant order number');
      const booking = await this.prisma.booking.findUnique({ where: { merchantOrderNumber: details.orderRefNumber } });
      if (!booking) return response.status(404).send('Order not found');
      try { await this.verifySbiOrder(booking.id); }
      catch { this.logger.warn('Callback verification deferred to scheduled search for booking ' + booking.id); }
      const appUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
      return response.redirect(303, appUrl + '/payment-status/' + encodeURIComponent(booking.id) + '#token=' + encodeURIComponent(booking.paymentAccessToken));
    } catch {
      return response.status(400).send('Invalid SBI callback');
    }
  }
}
