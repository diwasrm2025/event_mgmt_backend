import { Module } from '@nestjs/common';
import { EventFieldsService } from './event-fields.service';
import { EventFieldsController } from './event-fields.controller';

@Module({
  controllers: [EventFieldsController],
  providers: [EventFieldsService],
})
export class EventFieldsModule {}
