import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const BANNERS_DIR = join(process.cwd(), 'uploads', 'banners');
export const BANNERS_URL_PREFIX = '/uploads/banners';

if (!existsSync(BANNERS_DIR)) {
  mkdirSync(BANNERS_DIR, { recursive: true });
}

export function bannerFileFilter(_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
    callback(new BadRequestException('Only PNG, JPEG, or WebP images are allowed.'), false);
    return;
  }
  callback(null, true);
}

export const BANNER_UPLOAD_LIMITS = { fileSize: 5 * 1024 * 1024 };
