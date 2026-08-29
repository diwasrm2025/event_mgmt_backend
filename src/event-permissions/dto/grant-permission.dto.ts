import { ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ALL_EVENT_PERMISSIONS } from '../../common/permissions';

/** The person being shared with can be identified either way — by picking
 * them from the searchable user list (userId) or by typing their email
 * address directly, per the spec. Exactly one must be provided. */
export class GrantPermissionDto {
  @ValidateIf((dto) => !dto.email)
  @IsString()
  userId?: string;

  @ValidateIf((dto) => !dto.userId)
  @IsEmail()
  email?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one permission (View, Attendee Management, or Edit).' })
  @ArrayUnique()
  @IsIn(ALL_EVENT_PERMISSIONS, { each: true })
  permissions!: string[];
}
