import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ReorderFieldsDto } from './dto/reorder-fields.dto';

function slugifyKey(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field'
  );
}

/** Access to the parent event (VIEW for `list`, EDIT for every mutation)
 * is already verified by EventAccessGuard at the controller layer — this
 * service only needs to worry about the fields themselves. */
@Injectable()
export class EventFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueName(eventId: string, label: string, ignoreId?: string) {
    let name = slugifyKey(label);
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.prisma.eventFormField.findUnique({
        where: { eventId_name: { eventId, name } },
      });
      if (!existing || existing.id === ignoreId) return name;
      suffix += 1;
      name = `${slugifyKey(label)}_${suffix}`;
    }
  }

  async list(eventId: string) {
    return this.prisma.eventFormField.findMany({ where: { eventId }, orderBy: { order: 'asc' } });
  }

  async create(eventId: string, dto: CreateFieldDto) {
    if ((dto.type === 'select' || dto.type === 'radio') && !(dto.options && dto.options.length)) {
      throw new BadRequestException(`A ${dto.type} field needs at least one option.`);
    }

    const name = await this.uniqueName(eventId, dto.label);
    const count = await this.prisma.eventFormField.count({ where: { eventId } });

    return this.prisma.eventFormField.create({
      data: {
        eventId,
        name,
        label: dto.label.trim(),
        type: dto.type,
        required: Boolean(dto.required),
        options: dto.options ?? [],
        order: dto.order ?? count,
      },
    });
  }

  async update(eventId: string, fieldId: string, dto: UpdateFieldDto) {
    const existing = await this.prisma.eventFormField.findFirst({ where: { id: fieldId, eventId } });
    if (!existing) throw new NotFoundException('Field not found.');

    const data: Record<string, unknown> = { ...dto };
    if (typeof dto.label === 'string' && dto.label.trim() !== existing.label) {
      data.label = dto.label.trim();
      data.name = await this.uniqueName(eventId, dto.label, fieldId);
    }

    return this.prisma.eventFormField.update({ where: { id: fieldId }, data });
  }

  async remove(eventId: string, fieldId: string) {
    const existing = await this.prisma.eventFormField.findFirst({ where: { id: fieldId, eventId } });
    if (!existing) throw new NotFoundException('Field not found.');
    await this.prisma.eventFormField.delete({ where: { id: fieldId } });
    return { success: true };
  }

  async reorder(eventId: string, dto: ReorderFieldsDto) {
    await this.prisma.$transaction(
      dto.order.map((fieldId, index) =>
        this.prisma.eventFormField.update({ where: { id: fieldId }, data: { order: index } }),
      ),
    );
    return this.list(eventId);
  }
}
