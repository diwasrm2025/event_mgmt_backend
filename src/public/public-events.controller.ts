import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PublicEventsService } from './public-events.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';

@Controller('public')
export class PublicEventsController {
  constructor(
    private readonly publicEventsService: PublicEventsService,
    private readonly bookingsService: BookingsService,
  ) {}

  /** Browse published events without logging in ("see the events"). */
  @Get('events')
  findAll(@Query('search') search?: string, @Query('category') category?: string) {
    return this.publicEventsService.findPublished({ search, category });
  }

  /** The page a shared /events/[slug] URL resolves to. */
  @Get('events/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.publicEventsService.findBySlug(slug);
  }

  @Get('testing/:slug/:token')
  @UseGuards(JwtAuthGuard)
  testingPreview(@Param('slug') slug: string, @Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.publicEventsService.findTestingBySlug(slug, token, user);
  }

  @Post('testing/:slug/:token/bookings')
  @UseGuards(JwtAuthGuard)
  async testBooking(
    @Param('slug') slug: string,
    @Param('token') token: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.publicEventsService.findTestingBySlug(slug, token, user);
    return this.bookingsService.createTestingBooking(slug, token, dto, user);
  }

  /** Checkout step 1 — places the order through the event URL. Works for
   * guests and, if a bearer token is attached, for signed-in visitors too.
   * Free events are settled immediately; priced ones come back 'pending'
   * until the payment step below confirms them. */
  @Post('events/:slug/bookings')
  @UseGuards(OptionalJwtAuthGuard)
  book(@Param('slug') slug: string, @Body() dto: CreateBookingDto, @Req() req: { user?: { id: string } | null }) {
    return this.bookingsService.createBooking(slug, dto, req.user?.id ?? null);
  }

  @Get('bookings/:bookingId/payment-status')
  paymentStatus(@Param('bookingId') bookingId: string, @Query('token') token: string) {
    return this.bookingsService.paymentStatus(bookingId, token);
  }

  /** Checkout step 2 — simulated payment gateway callback. The booking id
   * doubles as the order token here, exactly like a checkout session id. */
}
