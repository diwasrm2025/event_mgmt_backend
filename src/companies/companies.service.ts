import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'company'
  );
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const companies = await this.prisma.company.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companies.map((c) => ({
      ...c,
      memberCount: c._count.users,
      eventCount: c._count.events,
      admins: c.users.filter(
        (u) => u.role.name === 'ORGANIZER' || u.role.name === 'SUPER_ADMIN' || u.role.name.includes('ADMIN'),
      ),
    }));
  }

  async findCompanyAdmins() {
    const admins = await this.prisma.user.findMany({
      where: {
        OR: [
          { companyId: { not: null } },
          { role: { name: { in: ['ORGANIZER', 'SUPER_ADMIN'] } } },
        ],
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            ownedEvents: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      avatarUrl: a.avatarUrl,
      role: a.role,
      company: a.company,
      eventsCount: a._count.ownedEvents,
      createdAt: a.createdAt,
    }));
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        events: true,
        _count: {
          select: {
            users: true,
            events: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID "${id}" not found.`);
    }
    return company;
  }

  async create(dto: CreateCompanyDto) {
    const slug = dto.slug ? slugify(dto.slug) : `${slugify(dto.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await this.prisma.company.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Company with slug "${slug}" already exists.`);
    }

    return this.prisma.company.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description || '',
        website: dto.website || '',
        logoUrl: dto.logoUrl || null,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.company.delete({
      where: { id },
    });
  }
}
