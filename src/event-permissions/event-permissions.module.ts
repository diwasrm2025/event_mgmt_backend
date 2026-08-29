import { Module } from '@nestjs/common';
import { EventPermissionsController } from './event-permissions.controller';
import { EventPermissionsService } from './event-permissions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EventPermissionsController],
  providers: [EventPermissionsService],
})
export class EventPermissionsModule {}
