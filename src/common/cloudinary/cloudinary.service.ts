import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

export type CloudinaryDeliveryType = 'upload' | 'authenticated';

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  format: string;
  version: number;
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  deliveryType: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(config: ConfigService) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim() ?? '';
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY')?.trim() ?? '';
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET')?.trim() ?? '';

    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  private configured() {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
    return cloudinary;
  }

  async uploadBuffer(
    buffer: Buffer,
    options: {
      folder: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      deliveryType?: CloudinaryDeliveryType;
      format?: UploadApiOptions['format'];
    },
  ): Promise<CloudinaryAsset> {
    const client = this.configured();
    const uploadOptions: UploadApiOptions = {
      folder: options.folder,
      resource_type: options.resourceType ?? 'auto',
      type: options.deliveryType ?? 'upload',
      ...(options.format ? { format: options.format } : {}),
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    };

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      client.uploader.upload_stream(uploadOptions, (error, uploaded) => {
        if (error) {
          this.logger.error('Cloudinary upload failed.', error.message);
          reject(new BadGatewayException('Cloudinary could not store the uploaded file.'));
          return;
        }
        if (!uploaded) {
          reject(new BadGatewayException('Cloudinary returned an empty upload result.'));
          return;
        }
        resolve(uploaded);
      }).end(buffer);
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format,
      version: result.version,
      resourceType: result.resource_type,
      deliveryType: result.type,
    };
  }

  async copyImageFromUrl(url: string, folder: string): Promise<CloudinaryAsset> {
    const client = this.configured();
    const parsedUrl = this.parseCloudinaryUrl(url);
    if (!parsedUrl || parsedUrl.resourceType !== 'image' || parsedUrl.deliveryType !== 'upload') {
      throw new BadGatewayException('The stored banner URL is not a copyable Cloudinary image.');
    }

    let result: UploadApiResponse;
    try {
      result = await client.uploader.upload(url, {
        folder,
        resource_type: 'image',
        type: 'upload',
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      });
    } catch (error) {
      this.logger.error('Cloudinary banner copy failed.', error instanceof Error ? error.message : String(error));
      throw new BadGatewayException('Cloudinary could not copy the event banner.');
    }
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format,
      version: result.version,
      resourceType: result.resource_type,
      deliveryType: result.type,
    };
  }

  async deleteByPublicId(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image', deliveryType = 'upload') {
    const client = this.configured();
    const result = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      this.logger.error(`Cloudinary deletion failed for ${publicId}.`, result.result);
      throw new BadGatewayException('Cloudinary could not delete the stored file.');
    }
  }

  async deleteImageByUrl(url: string): Promise<boolean> {
    const parsedUrl = this.parseCloudinaryUrl(url);
    if (!parsedUrl) return false;
    await this.deleteByPublicId(parsedUrl.publicId, parsedUrl.resourceType, parsedUrl.deliveryType);
    return true;
  }

  async downloadPrivateImage(publicId: string, format: string) {
    const client = this.configured();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(format.toLowerCase())) {
      throw new BadGatewayException('The stored payment screenshot has an unsupported format.');
    }
    const url = client.utils.private_download_url(publicId, format, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      this.logger.error(`Cloudinary screenshot download failed with HTTP ${response.status}.`);
      throw new BadGatewayException('Cloudinary could not retrieve the payment screenshot.');
    }
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 5 * 1024 * 1024) {
      throw new BadGatewayException('The stored payment screenshot exceeds the allowed size.');
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > 5 * 1024 * 1024) {
      throw new BadGatewayException('Cloudinary returned an invalid payment screenshot.');
    }
    return { data, format: format.toLowerCase() };
  }

  private parseCloudinaryUrl(url: string): {
    resourceType: 'image' | 'video' | 'raw';
    deliveryType: 'upload' | 'authenticated' | 'private';
    publicId: string;
  } | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] !== this.cloudName) return null;
    const resourceType = parts[1];
    if (resourceType !== 'image' && resourceType !== 'video' && resourceType !== 'raw') return null;
    const uploadIndex = parts.indexOf('upload');
    const deliveryType = parts[2];
    if (deliveryType !== 'upload' && deliveryType !== 'authenticated' && deliveryType !== 'private') return null;
    if (deliveryType === 'upload' && uploadIndex !== 2) return null;

    const publicIdStart = uploadIndex >= 0 ? uploadIndex + 1 : 3;
    const publicIdParts = parts.slice(publicIdStart).filter((part) => !/^v\d+$/.test(part) && !/^s--[^/]+--$/.test(part));
    if (!publicIdParts.length) return null;
    const lastPart = publicIdParts[publicIdParts.length - 1];
    const extensionIndex = lastPart.lastIndexOf('.');
    const publicIdLastPart = extensionIndex > 0 ? lastPart.slice(0, extensionIndex) : lastPart;
    if (!publicIdLastPart) return null;
    publicIdParts[publicIdParts.length - 1] = publicIdLastPart;
    return {
      resourceType,
      deliveryType,
      publicId: publicIdParts.map((part) => decodeURIComponent(part)).join('/'),
    };
  }
}
