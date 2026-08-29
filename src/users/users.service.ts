import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  /** Lightweight search used by the "grant access" searchable dropdown on
   * an event's permissions panel — returns a small, name/email-matched
   * list rather than the full user table. */
  search(query: string, excludeUserId?: string) {
    return this.prisma.user.findMany({
      where: {
        AND: [
          excludeUserId ? { id: { not: excludeUserId } } : {},
          query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 10,
      orderBy: { name: 'asc' },
    });
  }
}
