import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { RequireEventAccess } from '../common/decorators/event-access.decorator';
import { EVENT_PERMISSION } from '../common/permissions';
import { EventFieldsService } from './event-fields.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ReorderFieldsDto } from './dto/reorder-fields.dto';

/** Registration-form fields are part of an event's content, so they follow
 * the same VIEW/EDIT rules as the event itself — enforced here via
 * EventAccessGuard against the :eventId param, same as EventsController. */
@UseGuards(JwtAuthGuard, EventAccessGuard)
@Controller('events/:eventId/fields')
export class EventFieldsController {
  constructor(private readonly fieldsService: EventFieldsService) {}

  @RequireEventAccess(EVENT_PERMISSION.VIEW, 'eventId')
  @Get()
  list(@Param('eventId') eventId: string) {
    return this.fieldsService.list(eventId);
  }

  @RequireEventAccess(EVENT_PERMISSION.EDIT, 'eventId')
  @Post()
  create(@Param('eventId') eventId: string, @Body() dto: CreateFieldDto) {
    return this.fieldsService.create(eventId, dto);
  }

  @RequireEventAccess(EVENT_PERMISSION.EDIT, 'eventId')
  @Patch('reorder')
  reorder(@Param('eventId') eventId: string, @Body() dto: ReorderFieldsDto) {
    return this.fieldsService.reorder(eventId, dto);
  }

  @RequireEventAccess(EVENT_PERMISSION.EDIT, 'eventId')
  @Patch(':fieldId')
  update(@Param('eventId') eventId: string, @Param('fieldId') fieldId: string, @Body() dto: UpdateFieldDto) {
    return this.fieldsService.update(eventId, fieldId, dto);
  }

  @RequireEventAccess(EVENT_PERMISSION.EDIT, 'eventId')
  @Delete(':fieldId')
  remove(@Param('eventId') eventId: string, @Param('fieldId') fieldId: string) {
    return this.fieldsService.remove(eventId, fieldId);
  }
}
