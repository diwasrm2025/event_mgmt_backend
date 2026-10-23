import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryEventsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['published', 'draft', 'sold-out'])
  status?: string;
}
