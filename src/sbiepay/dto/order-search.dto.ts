import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString, ValidateIf } from 'class-validator';

export class OrderSearchDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  orderAmount!: number;

  @IsString()
  @IsNotEmpty()
  orderRefNumber!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  sbiOrderRefNumber?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  atrnNumber?: string;
}
