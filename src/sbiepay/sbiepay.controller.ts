import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { OrderSearchDto } from './dto/order-search.dto';
import { SbiepayService } from './sbiepay.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sbiepay')
export class SbiepayController {
  constructor(private readonly sbiepayService: SbiepayService) {}

  @RequirePermissions(PERMISSIONS.EVENTS_MANAGE_ALL)
  @Post('order-search')
  searchOrder(@Body() orderSearchDetails: OrderSearchDto) {
    return this.sbiepayService.searchOrder(orderSearchDetails);
  }
}
