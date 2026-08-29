import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export const FIELD_TYPES = ['text', 'email', 'phone', 'number', 'date', 'textarea', 'select', 'checkbox', 'radio'];

export class CreateFieldDto {
  @IsString()
  @MinLength(1, { message: 'Label is required.' })
  label: string;

  @IsIn(FIELD_TYPES, { message: `Type must be one of: ${FIELD_TYPES.join(', ')}` })
  type: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
