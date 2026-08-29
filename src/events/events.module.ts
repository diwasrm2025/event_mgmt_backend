import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsLifecycleService } from './events-lifecycle.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsLifecycleService],
})
export class EventsModule {}
