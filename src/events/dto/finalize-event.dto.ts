import { IsIn, IsOptional } from 'class-validator';
import { EventStatus, STATUSES } from './create-event.dto';

export class FinalizeEventDto {
  @IsOptional()
  @IsIn(STATUSES, { message: `Status must be one of: ${STATUSES.join(', ')}` })
  status?: EventStatus;
}
