import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventsService } from './events.service';

const CHECK_INTERVAL_MS = 60_000;

/** Polls once a minute for any published (or sold-out) event whose date +
 * time has passed and flips it to 'completed', purging its banner images.
 * Implemented as a plain setInterval rather than @nestjs/schedule/cron to
 * avoid an extra dependency for a single periodic job; swap in
 * @nestjs/schedule's @Cron if this project later needs more jobs like it. */
@Injectable()
export class EventsLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsLifecycleService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly eventsService: EventsService) {}

  onModuleInit() {
    this.runCheck();
    this.timer = setInterval(() => this.runCheck(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCheck() {
    try {
      const { completed } = await this.eventsService.autoCompletePastEvents();
      if (completed > 0) {
        this.logger.log(`Marked ${completed} event(s) as completed and cleared their banner images.`);
      }
    } catch (err) {
      this.logger.error(`Auto-complete check failed: ${(err as Error).message}`);
    }
  }
}
