import { Injectable } from '@nestjs/common';
import { SBIEPayClient } from 'epay_nodejs_sdk';

@Injectable()
export class SbiepayService {
  private readonly client: SBIEPayClient;

  constructor() {
    this.client = new SBIEPayClient(
      {
        apiKey: process.env.SBIEPAY_API_KEY!,
        apiSecret: process.env.SBIEPAY_API_SECRET!,
        encryptionKey: process.env.SBIEPAY_ENCRYPTION_KEY!,
      },
      'SANDBOX',
      false,
      'JSON',
    );
  }

  async createOrder(payload: any) {
    return this.client.order.create(payload);
  }
  async decodeCallback(payload: string) {
    return this.client.crypto.decodeCallback(payload);
  }
}