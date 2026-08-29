import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseSeederService } from './database-seeder.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseSeederService],
  exports: [PrismaService],
})
export class PrismaModule {}
