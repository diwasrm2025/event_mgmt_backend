import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MailModule } from '../mail/mail.module';
import { SbiepayModule } from '../sbiepay/sbiepay.module';
import { SbiepayCallbackController } from './sbiepay-callback.controller';
import { SbiepayVerificationJob } from './sbiepay-verification.job';
@Module({
  imports: [MailModule,SbiepayModule],
  controllers: [BookingsController,SbiepayCallbackController],
  providers: [BookingsService, SbiepayVerificationJob],
  exports: [BookingsService],
})
export class BookingsModule {}
