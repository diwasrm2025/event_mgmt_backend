import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SBIEPayClient } from 'epay_nodejs_sdk';
import type { OrderSearchEntity } from 'epay_nodejs_sdk';

@Injectable()
export class SbiepayService {
  private sbiePayClient?: SBIEPayClient;

  private getClient(): SBIEPayClient {
    if (this.sbiePayClient) return this.sbiePayClient;
    const required = ['SBIEPAY_API_KEY', 'SBIEPAY_API_SECRET', 'SBIEPAY_ENCRYPTION_KEY'];
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length) {
      throw new ServiceUnavailableException(`Paid registration is unavailable. Configure ${missing.join(', ')} on the API server.`);
    }
    const environment = process.env.SBIEPAY_ENVIRONMENT?.trim() || 'SANDBOX';
    if (environment !== 'LIVE' && environment !== 'SANDBOX') {
      throw new ServiceUnavailableException('SBIEPAY_ENVIRONMENT must be LIVE or SANDBOX.');
    }
    this.sbiePayClient = new SBIEPayClient(
      {
        apiKey: process.env.SBIEPAY_API_KEY!,
        apiSecret: process.env.SBIEPAY_API_SECRET!,
        encryptionKey: process.env.SBIEPAY_ENCRYPTION_KEY!,
      },
      environment,
      false,
      'JSON',
    );
    return this.sbiePayClient;
  }

  assertConfigured(): void {
    this.getClient();
  }

  async createOrder(payload: any) {
    return this.withTimeout(this.getClient().order.create(payload));
  }
  
  async searchOrder(orderSearchDetails: OrderSearchEntity) {
    console.log('========== SBI EPAY ORDER SEARCH REQUEST ==========');
    console.log(JSON.stringify(this.sanitizeForLog(orderSearchDetails), null, 2));

    try {
      const orderSearch = await this.withTimeout(
        this.getClient().order.search(orderSearchDetails),
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
    return this.getClient().crypto.decodeCallback(payload);
  }
}
