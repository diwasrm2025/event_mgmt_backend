import { IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @MinLength(2, { message: 'Name is required.' })
  name: string;

  @IsEmail({}, { message: 'A valid email is required.' })
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['razorpay', 'offline'])
  paymentMethod?: 'razorpay' | 'offline';

  /** Answers keyed by the EventFormField.name for that event's custom fields. */
  @IsOptional()
  @IsObject()
  responses?: Record<string, unknown>;

}
