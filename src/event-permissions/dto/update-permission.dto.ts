import { ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import { ALL_EVENT_PERMISSIONS } from '../../common/permissions';

export class UpdatePermissionDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one permission, or use Revoke Access to remove access entirely.' })
  @ArrayUnique()
  @IsIn(ALL_EVENT_PERMISSIONS, { each: true })
  permissions!: string[];
}
