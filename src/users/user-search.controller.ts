import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('people')
export class UserSearchController {
  constructor(private readonly usersService: UsersService) {}

  /** Used by the "share this event" searchable dropdown. Any signed-in
   * user can search for a person to share one of THEIR OWN events with —
   * this is not a users-administration endpoint. */
  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: AuthUser) {
    return this.usersService.search(q ?? '', user.id);
  }
}
