import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

@Injectable()
export class SbiepayVerificationJob {
  private readonly logger = new Logger(SbiepayVerificationJob.name);
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly bookings: BookingsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async verifyUnresolvedOrders() {
    if (this.running) return;
    this.running = true;
    // A fixed cutoff prevents newly created orders from extending a run indefinitely.
    const cutoff = new Date();
    let cursor: string | undefined;
    try {
      while (true) {
        const orders = await this.prisma.booking.findMany({
          where: { paymentMethod: 'sbiepay', paymentStatus: 'pending', merchantOrderNumber: { not: null }, createdAt: { lte: cutoff } },
          select: { id: true }, orderBy: { id: 'asc' }, take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!orders.length) break;
        for (const order of orders) {
          try { await this.bookings.verifySbiOrder(order.id); }
          catch { this.logger.warn(`Order Search unsuccessful for booking ${order.id}; will retry next run.`); }
        }
        cursor = orders[orders.length - 1].id;
      }
    } catch {
      this.logger.error('Unable to collect unresolved SBI orders; will retry next run.');
    } finally {
      this.running = false;
    }
  }
}
