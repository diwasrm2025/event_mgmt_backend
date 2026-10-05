import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class SbiepayCallbackController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('sbiepay/callback')
  async callbackGet(@Req() request: Request, @Res() response: Response) {
    return this.bookingsService.handleSbiEpayCallback(request, response);
  }

  @Post('sbiepay/callback')
  async callbackPost(@Req() request: Request, @Res() response: Response) {
    return this.bookingsService.handleSbiEpayCallback(request, response);
  }
}