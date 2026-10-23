import { Transform } from 'class-transformer';
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
export class QrCodeDto {
 @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
 @IsString() @MinLength(1) @MaxLength(200)
 title: string;
 @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
 @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false }) @MaxLength(2000)
 url: string;
}
