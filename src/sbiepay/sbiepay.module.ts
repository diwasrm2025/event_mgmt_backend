import { Module } from '@nestjs/common';
import { SbiepayService } from './sbiepay.service';

@Module({
  providers: [SbiepayService],
  exports: [SbiepayService],
})
export class SbiepayModule {}