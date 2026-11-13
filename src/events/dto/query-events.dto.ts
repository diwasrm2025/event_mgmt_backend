import { IsIn, IsOptional, IsString } from 'class-validator';
import { EventStatus, STATUSES } from './create-event.dto';

export class QueryEventsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(STATUSES, { message: `Status must be one of: ${STATUSES.join(', ')}` })
  status?: EventStatus;
}
