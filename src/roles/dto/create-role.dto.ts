import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '../../common/permissions';

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z0-9_]+$/, { message: 'name must be UPPER_SNAKE_CASE (letters, numbers, underscore only).' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: string[];
}
