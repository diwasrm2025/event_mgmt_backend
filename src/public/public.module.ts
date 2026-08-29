import { Module } from '@nestjs/common';
import { PublicEventsController } from './public-events.controller';
import { PublicEventsService } from './public-events.service';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  controllers: [PublicEventsController],
  providers: [PublicEventsService],
})
export class PublicModule {}
