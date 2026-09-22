import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireEventAccess } from '../common/decorators/event-access.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS, EVENT_PERMISSION } from '../common/permissions';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { FinalizeEventDto } from './dto/finalize-event.dto';
import { BANNER_UPLOAD_LIMITS, bannerFileFilter, bannerStorage } from './banner-storage';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** Owned events, events shared with the user, and — for Super Admins —
   * every event in the system. Scoping happens in the service based on the
   * caller's id/permissions, since there's no single event id to check
   * here (that's what EventAccessGuard is for, below). */
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryEventsDto) {
    return this.eventsService.findAll(user, query);
  }

  @RequirePermissions(PERMISSIONS.EVENTS_MANAGE_ALL)
  @Get('admin/all')
  findAllSystemEvents() {
    return this.eventsService.findAllSystemEvents();
  }

  @Get('activity')
  activity(@CurrentUser() user: AuthUser) {
    return this.eventsService.getActivity(user.id);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.VIEW)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.findOneForUser(id, user);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.VIEW)
  @Get(':id/dashboard')
  async dashboard(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const event = await this.eventsService.findOneForUser(id, user);
    const summary = await this.eventsService.dashboardSummary(id);
    return { ...summary, checkedInAttendees: event.isOwner || event.sharedPermissions.includes(EVENT_PERMISSION.ATTENDEE) ? summary.checkedInAttendees : undefined };
  }

  @RequirePermissions(PERMISSIONS.EVENTS_CREATE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, dto);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.update(id, dto, user.id);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.EDIT)
  @Post(':id/finalize')
  finalize(@Param('id') id: string, @Body() dto: FinalizeEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.finalize(id, dto, user.id);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.EDIT)
  @Post(':id/banners')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: bannerStorage,
      fileFilter: bannerFileFilter,
      limits: BANNER_UPLOAD_LIMITS,
    }),
  )
  uploadBanner(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file was uploaded.');
    return this.eventsService.addBanner(id, file);
  }

  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.EDIT)
  @Delete(':id/banners')
  removeBanner(@Param('id') id: string, @Body('url') url: string) {
    if (!url) throw new BadRequestException('A banner url is required.');
    return this.eventsService.removeBanner(id, url);
  }

  /** Delete requires an EDIT-or-higher grant to reach the guard, but the
   * service enforces the stricter "owner or Super Admin only" rule on top
   * — a shared EDIT collaborator can manage content but not delete or
   * re-share the event. */
  @UseGuards(EventAccessGuard)
  @RequireEventAccess(EVENT_PERMISSION.EDIT)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.remove(id, user);
  }
}
