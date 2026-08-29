import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('create-order')
  async createOrder(
    @Body('bookingId') bookingId: string,
  ) {
    return this.paymentsService.createOrder(bookingId);
  }

  @Post('verify')
  async verifyPayment(
    @Body('bookingId') bookingId: string,
    @Body('razorpayOrderId') razorpayOrderId: string,
    @Body('razorpayPaymentId') razorpayPaymentId: string,
    @Body('razorpaySignature') razorpaySignature: string,
  ) {
    return this.paymentsService.verifyPayment(
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
  }
}