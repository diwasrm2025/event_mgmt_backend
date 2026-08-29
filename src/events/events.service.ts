import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { FinalizeEventDto } from './dto/finalize-event.dto';
import { BANNERS_URL_PREFIX } from './banner-storage';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/permissions';
import { unlink } from 'fs/promises';
import { join } from 'path';

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'event'
  );
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueSlug(title: string, ignoreId?: string) {
    let slug = slugify(title);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.event.findUnique({ where: { slug } });
      if (!existing || existing.id === ignoreId) return slug;
      slug = `${slugify(title)}-${randomSuffix()}`;
    }
  }

  async findAllSystemEvents() {
    const events = await this.prisma.event.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return events.map((e) => ({
      ...e,
      totalBookings: e._count.bookings,
    }));
  }

  /** Owned events + events explicitly shared with this user. Super Admins
   * (events:manage_all) see every event in the system, dashboard-wide. */
  async findAll(user: AuthUser, query: QueryEventsDto) {
    const isSuperAdmin = user.permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL);

    const events = await this.prisma.event.findMany({
      where: isSuperAdmin
        ? {}
        : {
            OR: [{ ownerId: user.id }, { permissions: { some: { userId: user.id, status: 'ACTIVE' } } }],
          },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        permissions: { where: { userId: user.id, status: 'ACTIVE' }, select: { permissions: true } },
      },
      orderBy: { date: 'asc' },
    });

    return (events ?? [])
      .filter((event) => {
        if (!query.search) return true;
        const haystack = `${event.title} ${event.venue} ${event.host}`.toLowerCase();
        return haystack.includes(query.search.toLowerCase());
      })
      .filter((event) => !query.category || event.category === query.category)
      .filter((event) => !query.status || event.status === query.status)
      .map((event) => {
        const isOwner = event.ownerId === user.id;
        const userPermRecord = event.permissions?.[0];
        const sharedPermissions = isOwner ? ['ALL'] : (userPermRecord?.permissions || []);
        return {
          ...event,
          isOwner,
          ownerName: isOwner ? 'Own' : (event.owner?.name || event.host || 'Organizer'),
          ownerEmail: event.owner?.email,
          sharedPermissions,
        };
      });
  }

  /** Access has already been verified by EventAccessGuard for :id routes —
   * this just loads the record. */
  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { order: 'asc' } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found.');
    return event;
  }

  /** Event Dashboard summary: owner, live shared-members count, and
   * registration/check-in stats, computed fresh on every call (no cached
   * counters to drift out of sync). */
  async dashboardSummary(id: string) {
    const event = await this.findOne(id);

    const [sharedMembersCount, totalRegistrations, checkedInAttendees, pendingRegistrations] = await Promise.all([
      this.prisma.eventPermission.count({ where: { eventId: id, status: 'ACTIVE' } }),
      this.prisma.booking.count({ where: { eventId: id } }),
      this.prisma.booking.count({ where: { eventId: id, checkedIn: true } }),
      this.prisma.booking.count({ where: { eventId: id, registrationStatus: 'pending' } }),
    ]);

    return {
      owner: event.owner,
      sharedMembersCount,
      totalRegistrations,
      checkedInAttendees,
      pendingRegistrations,
      status: event.status,
      updatedAt: event.updatedAt,
    };
  }

  /** Step 0: start the wizard. Only the title is required — every other
   * field is filled in over the following PATCH-per-step calls. The
   * creator automatically becomes the owner. */
  async create(ownerId: string, dto: CreateEventDto) {
    if ((dto.attendees ?? 0) > (dto.capacity ?? 0)) {
      throw new BadRequestException('Booked seats cannot exceed capacity.');
    }

    const event = await this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        category: dto.category ?? 'Community',
        date: dto.date ?? '',
        time: dto.time ?? '',
        eventMode: dto.eventMode ?? 'offline',
        onlineUrl: dto.onlineUrl?.trim() ?? '',
        venue: dto.venue?.trim() ?? '',
        capacity: dto.capacity ?? 0,
        attendees: dto.attendees ?? 0,
        price: dto.price ?? 0,
        status: dto.status ?? 'draft',
        description: dto.description?.trim() ?? '',
        agenda: dto.agenda ?? [],
        host: dto.host?.trim() || 'Organizer',
        featured: Boolean(dto.featured),
        banners: dto.banners ?? [],
        wizardStep: dto.wizardStep ?? 1,
        slug: null,
        ownerId,
      },
    });

    await this.logActivity(ownerId, 'created', event.title);
    return event;
  }

  /** Used for every wizard step's PATCH, and for quick edits after an event
   * is finalized. Never touches `slug` — that only changes via finalize(). */
  async update(id: string, dto: UpdateEventDto, actingUserId: string) {
    const existing = await this.findOne(id);

    const nextCapacity = dto.capacity ?? existing.capacity;
    const nextAttendees = dto.attendees ?? existing.attendees;
    if (nextAttendees > nextCapacity) {
      throw new BadRequestException('Booked seats cannot exceed capacity.');
    }

    const data: Record<string, unknown> = { ...dto };
    delete (data as { slug?: unknown }).slug;
    delete (data as { ownerId?: unknown }).ownerId;
    if (typeof dto.title === 'string') data.title = dto.title.trim();
    if (typeof dto.venue === 'string') data.venue = dto.venue.trim();
    if (typeof dto.onlineUrl === 'string') data.onlineUrl = dto.onlineUrl.trim();
    if (typeof dto.host === 'string') data.host = dto.host.trim();
    if (typeof dto.description === 'string') data.description = dto.description.trim();

    const event = await this.prisma.event.update({
      where: { id },
      data,
    });

    await this.logActivity(actingUserId, 'updated', event.title);
    return event;
  }

  /** Final wizard step: validates the event is actually complete, then
   * generates the public slug/URL the very first time it's called. Calling
   * it again on an already-finalized event just updates status. */
  async finalize(id: string, dto: FinalizeEventDto, actingUserId: string) {
    const existing = await this.findOne(id);

    const missing: string[] = [];
    if (!existing.title?.trim()) missing.push('title');
    if (!existing.date) missing.push('date');
    if (!existing.time) missing.push('time');
    if (existing.eventMode === 'online' ? !existing.onlineUrl?.trim() : !existing.venue?.trim()) {
      missing.push(existing.eventMode === 'online' ? 'onlineUrl' : 'venue');
    }
    if (!existing.capacity) missing.push('capacity');
    if (missing.length) {
      throw new BadRequestException(`Complete these fields before publishing: ${missing.join(', ')}.`);
    }

    const slug = existing.slug ?? (await this.uniqueSlug(existing.title, existing.id));

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        slug,
        status: dto.status ?? (existing.status === 'draft' ? 'published' : existing.status),
        wizardStep: 5,
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    await this.logActivity(actingUserId, 'updated', event.title);
    return event;
  }

  /** Deleting (and, implicitly, re-sharing) an event is restricted to the
   * owner or a Super Admin, even though EventAccessGuard already let an
   * EDIT-level collaborator through to this point for content edits. */
  async remove(id: string, user: AuthUser) {
    const existing = await this.findOne(id);
    const isSuperAdmin = user.permissions.includes(PERMISSIONS.EVENTS_MANAGE_ALL);
    if (!isSuperAdmin && existing.ownerId !== user.id) {
      throw new ForbiddenException('Only the event owner or a Super Admin can delete this event.');
    }

    for (const banner of existing.banners) {
      await this.deleteBannerFile(banner);
    }
    await this.prisma.event.delete({ where: { id } });
    await this.logActivity(user.id, 'deleted', existing.title);
    return { success: true };
  }

  async addBanner(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);
    if (existing.banners.length >= 8) {
      throw new BadRequestException('You can add up to 8 banner images.');
    }
    const url = `${BANNERS_URL_PREFIX}/${file.filename}`;
    const event = await this.prisma.event.update({
      where: { id },
      data: { banners: { push: url } },
    });
    return event;
  }

  async removeBanner(id: string, url: string) {
    const existing = await this.findOne(id);
    if (!existing.banners.includes(url)) {
      throw new NotFoundException('Banner not found on this event.');
    }
    const event = await this.prisma.event.update({
      where: { id },
      data: { banners: existing.banners.filter((banner) => banner !== url) },
    });
    await this.deleteBannerFile(url);
    return event;
  }

  private async deleteBannerFile(url: string) {
    if (!url.startsWith(BANNERS_URL_PREFIX)) return;
    const filePath = join(process.cwd(), 'uploads', 'banners', url.replace(`${BANNERS_URL_PREFIX}/`, ''));
    try {
      await unlink(filePath);
    } catch {
      // File may already be gone — nothing else to do.
    }
  }

  /** Runs periodically (see EventsLifecycleService). Any 'published' event
   * whose date + time has passed is moved to 'completed' and has its
   * banner images deleted from disk — the storage is reclaimed, but the
   * event row itself (and its bookings/attendee history) is kept forever
   * so it still shows up, correctly labeled, in every list and report. */
  async autoCompletePastEvents() {
    const candidates = await this.prisma.event.findMany({
      where: { status: { in: ['published', 'sold-out'] } },
      select: { id: true, date: true, time: true, banners: true, title: true },
    });

    const now = Date.now();
    const due = candidates.filter((event) => {
      if (!event.date) return false;
      let timeNormalized = (event.time || '00:00').trim();
      const ampmMatch = timeNormalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampmMatch) {
        let hours = parseInt(ampmMatch[1], 10);
        const minutes = ampmMatch[2];
        const period = ampmMatch[3].toUpperCase();
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        timeNormalized = `${String(hours).padStart(2, '0')}:${minutes}`;
      }
      const stamp = new Date(`${event.date}T${timeNormalized}:00`).getTime();
      return Number.isFinite(stamp) && stamp <= now;
    });

    for (const event of due) {
      await Promise.all(event.banners.map((banner) => this.deleteBannerFile(banner)));
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: 'completed', banners: [] },
      });
    }

    return { completed: due.length };
  }

  private async logActivity(userId: string, action: 'created' | 'updated' | 'deleted', title: string) {
    await this.prisma.activity.create({ data: { userId, action, title } });
  }

  async getActivity(userId: string) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { at: 'desc' },
      take: 30,
    });
  }
}
