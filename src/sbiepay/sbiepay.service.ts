import { Injectable } from '@nestjs/common';
import { SBIEPayClient } from 'epay_nodejs_sdk';
import type { OrderSearchEntity } from 'epay_nodejs_sdk';

@Injectable()
export class SbiepayService {
  private readonly sbiePayClient: SBIEPayClient;

  constructor() {
    this.sbiePayClient = new SBIEPayClient(
      {
        apiKey: process.env.SBIEPAY_API_KEY!,
        apiSecret: process.env.SBIEPAY_API_SECRET!,
        encryptionKey: process.env.SBIEPAY_ENCRYPTION_KEY!,
      },
      process.env.SBIEPAY_ENVIRONMENT === 'LIVE' ? 'LIVE' : 'SANDBOX',
      false,
      'JSON',
    );
  }

  async createOrder(payload: any) {
    return this.withTimeout(this.sbiePayClient.order.create(payload));
  }
  
  async searchOrder(orderSearchDetails: OrderSearchEntity) {
    console.log('========== SBI EPAY ORDER SEARCH REQUEST ==========');
    console.log(JSON.stringify(this.sanitizeForLog(orderSearchDetails), null, 2));

    try {
      const orderSearch = await this.withTimeout(
        this.sbiePayClient.order.search(orderSearchDetails),
      );

      console.log('========== SBI EPAY ORDER SEARCH RESPONSE ==========');
      console.log(JSON.stringify(this.sanitizeForLog(orderSearch), null, 2));

      return orderSearch;
    } catch (error) {
      console.error('========== SBI EPAY ORDER SEARCH ERROR ==========');
      console.error(error instanceof Error ? error.name : 'Unknown error');

      throw error;
    }
  }

  private sanitizeForLog(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForLog(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          /secret|credential|token|password|authorization|api.?key|encryption.?key/i.test(key)
            ? '[REDACTED]'
            : this.sanitizeForLog(item),
        ]),
      );
    }
    return value;
  }

  private async withTimeout<T>(request: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('SBI API request timed out')), 30000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async decodeCallback(payload: string) {
    return this.sbiePayClient.crypto.decodeCallback(payload);
  }
}
