import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

/** name is intentionally excludable via PartialType, but the service layer
 * still refuses to rename or delete a system role. */
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
