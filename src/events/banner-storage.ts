import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const BANNERS_DIR = join(process.cwd(), 'uploads', 'banners');
export const BANNERS_URL_PREFIX = '/uploads/banners';

if (!existsSync(BANNERS_DIR)) {
  mkdirSync(BANNERS_DIR, { recursive: true });
}

export const bannerStorage = diskStorage({
  destination: BANNERS_DIR,
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

export function bannerFileFilter(_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) {
  if (!file.mimetype.startsWith('image/')) {
    callback(new BadRequestException('Only image files are allowed.'), false);
    return;
  }
  callback(null, true);
}

export const BANNER_UPLOAD_LIMITS = { fileSize: 5 * 1024 * 1024 };
