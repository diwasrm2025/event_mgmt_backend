import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const CATEGORIES = ['Music', 'Conference', 'Workshop', 'Sports', 'Festival', 'Community'];
export const STATUSES = ['published', 'draft', 'sold-out', 'completed'];

/**
 * Used both to create a fresh draft (only `title` is required — the wizard
 * fills everything else in over its later steps) and, via UpdateEventDto
 * below, to PATCH any single step of that wizard.
 */
export class CreateEventDto {
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters.' })
  title: string;

  @IsOptional()
  @IsIn(CATEGORIES, { message: `Category must be one of: ${CATEGORIES.join(', ')}` })
  category?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsIn(['online', 'offline'])
  eventMode?: 'online' | 'offline';

  @IsOptional()
  @IsString()
  onlineUrl?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attendees?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(STATUSES, { message: `Status must be one of: ${STATUSES.join(', ')}` })
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  agenda?: string[];

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: 'You can add up to 8 banner images.' })
  @IsString({ each: true })
  banners?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wizardStep?: number;
}
