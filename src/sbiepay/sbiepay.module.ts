import { Module } from '@nestjs/common';
import { SbiepayController } from './sbiepay.controller';
import { SbiepayService } from './sbiepay.service';

@Module({
  controllers: [SbiepayController],
  providers: [SbiepayService],
  exports: [SbiepayService],
})
export class SbiepayModule {}