import { QrCodesModule } from './qr-codes/qr-codes.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { EventFieldsModule } from './event-fields/event-fields.module';
import { BookingsModule } from './bookings/bookings.module';
import { PublicModule } from './public/public.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { EventPermissionsModule } from './event-permissions/event-permissions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { SbiepayModule } from './sbiepay/sbiepay.module';
import { CompaniesModule } from './companies/companies.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    QrCodesModule,
    PrismaModule,
    AuthModule,
    EventsModule,
    EventFieldsModule,
    BookingsModule,
    SbiepayModule,
    PublicModule,
    RolesModule,
    UsersModule,
    EventPermissionsModule,
    NotificationsModule,
    MailModule,
    CompaniesModule,
  ],
})
export class AppModule {}
