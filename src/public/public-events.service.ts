import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function parseDateTime(dateStr?: string, timeStr?: string): number | null {
  if (!dateStr) return null;
  let timeNormalized = timeStr?.trim() || '00:00';
  const ampmMatch = timeNormalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    timeNormalized = `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  const timestamp = new Date(`${dateStr}T${timeNormalized}:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

@Injectable()
export class PublicEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private omitOwner<T extends { ownerId: string }>(event: T) {
    const { ownerId: _ownerId, ...rest } = event;
    return rest;
  }

  async findPublished(filters: { search?: string; category?: string }) {
    const now = Date.now();
    const events = await this.prisma.event.findMany({
      where: { status: { in: ['published', 'sold-out'] }, slug: { not: null } },
      orderBy: { date: 'asc' },
    });

    return events
      .filter((event) => {
        // Exclude events where date + time has expired
        const eventTime = parseDateTime(event.date, event.time);
        if (eventTime && eventTime < now) return false;
        return true;
      })
      .filter((event) => {
        if (!filters.search) return true;
        const haystack = `${event.title} ${event.venue} ${event.host}`.toLowerCase();
        return haystack.includes(filters.search.toLowerCase());
      })
      .filter((event) => !filters.category || event.category === filters.category)
      .map((event) => this.omitOwner(event));
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: { in: ['published', 'sold-out', 'completed'] } },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!event) throw new NotFoundException('This event could not be found.');
    return this.omitOwner(event);
  }
}
