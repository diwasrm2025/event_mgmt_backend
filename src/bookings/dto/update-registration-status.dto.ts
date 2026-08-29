import { IsIn } from 'class-validator';

export const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected'] as const;

export class UpdateRegistrationStatusDto {
  @IsIn(REGISTRATION_STATUSES, { message: `status must be one of: ${REGISTRATION_STATUSES.join(', ')}` })
  status!: 'pending' | 'approved' | 'rejected';
}
