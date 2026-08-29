import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserSearchController } from './user-search.controller';
import { UsersService } from './users.service';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RolesModule],
  controllers: [UsersController, UserSearchController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
