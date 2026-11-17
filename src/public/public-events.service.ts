import { isCompletedEvent } from '../events/event-lifecycle';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/permissions';

@Injectable()
export class PublicEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private omitOwner<T extends { ownerId: string; previewToken?: string | null }>(event: T) {
    const { ownerId: _ownerId, previewToken: _previewToken, ...rest } = event;
    return rest;
  }

  async findTestingBySlug(slug: string, token: string, user: AuthUser) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: 'testing', previewToken: token },
      include: {
        fields: { orderBy: { order: 'asc' } },
        permissions: { where: { userId: user.id, status: 'ACTIVE' }, select: { id: true } },
      },
    });
    if (!event) throw new NotFoundException('Testing preview not found.');
    const isOwner = event.ownerId === user.id;
    const isSuperAdmin = user.permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL);
    if (!isOwner && !isSuperAdmin && !event.permissions.length) {
      throw new NotFoundException('Testing preview not found.');
    }
    const { permissions: _permissions, ...preview } = event;
    return this.omitOwner(preview);
  }

  async findPublished(filters: { search?: string; category?: string }) {
    const now = Date.now();
    const events = await this.prisma.event.findMany({
      where: { status: { in: ['published', 'sold-out', 'completed'] }, slug: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    return events
      .filter((event) => !isCompletedEvent(event, now))
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
    if (event.registrationDeadline && event.registrationDeadline.getTime() <= Date.now()) return { id: event.id, slug: event.slug, registrationDeadline: event.registrationDeadline, registrationClosed: true };
    return this.omitOwner(event);
  }
}
