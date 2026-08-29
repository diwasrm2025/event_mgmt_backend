import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Razorpay = require('razorpay');
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(private readonly prisma: PrismaService) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  async createOrder(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      include: {
        event: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentStatus !== 'pending') {
      throw new BadRequestException('Booking is not pending payment');
    }

    const amount = booking.event.price * booking.seats;

    if (amount <= 0) {
      throw new BadRequestException(
        'Cannot create Razorpay order for a free booking',
      );
    }

    const order = await this.razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: booking.id,
    });

    await this.prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        razorpayOrderId: order.id,
        paymentStatus: 'pending',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }
  async verifyPayment(
  bookingId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  const booking = await this.prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      event: true,
    },
  });

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (booking.razorpayOrderId !== razorpayOrderId) {
    throw new BadRequestException('Invalid Razorpay order');
  }

  const generatedSignature = crypto
    .createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET!,
    )
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    throw new BadRequestException('Invalid payment signature');
  }

  if (booking.paymentStatus === 'paid') {
    return booking;
  }

  if (
    booking.event.capacity > 0 &&
    booking.event.attendees + booking.seats > booking.event.capacity
  ) {
    throw new BadRequestException(
      'Seats sold out while payment was processing.',
    );
  }

  const [updatedBooking] = await this.prisma.$transaction([
    this.prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        paymentStatus: 'paid',
        transactionId: razorpayPaymentId,
        paidAt: new Date(),
      },
    }),

    this.prisma.event.update({
      where: {
        id: booking.event.id,
      },
      data: {
        attendees: {
          increment: booking.seats,
        },
        ...(booking.event.capacity > 0 &&
        booking.event.attendees + booking.seats >= booking.event.capacity
          ? { status: 'sold-out' }
          : {}),
      },
    }),
  ]);

  return updatedBooking;
  }
}