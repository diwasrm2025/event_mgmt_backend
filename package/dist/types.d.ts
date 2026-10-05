/**
 * This file contains all the shared TypeScript interfaces for API payloads and entities.
 */
/**
 * A generic interface for key-value pair objects (like 'notes').
 */
export interface KeyValueObject {
    [key: string]: string | number | boolean;
}
/**
 * Request Types
 */
export interface RequestEntity {
    encryptedRequest: string;
}
/**
 * Response Types
 */
export interface EncryptedResponseEntity {
    encryptedResponse: string;
}
export interface ResponseEntity {
    status: number;
    data?: any[];
    errors?: any[];
}
/**
 * Configuration options for the SDK client.
 */
export interface SDKCredentials {
    apiKey: string;
    apiSecret: string;
    encryptionKey: string;
}
/**
 * Customer Types
 */
export interface CustomerEntity {
    customerName: string;
    email: string;
    gstIn?: string;
    gstInAddress?: string;
    phoneNumber: string;
    address1: string;
    address2?: string;
    city?: string;
    state?: string;
    country: string;
    pinCode: string;
}
/**
 * Order Types
 */
export interface OrderEntity {
    customerId?: string;
    currencyCode: string;
    orderAmount: number;
    orderRefNumber: string;
    sbiOrderRefNumber?: string;
    status?: string;
    otherDetails?: string;
    expiry?: number;
    multiAccounts?: string;
    paymentMode?: string;
    orderHash?: string;
    returnUrl: string;
    transactionUrl?: string;
    orderRetryCount?: number;
    thirdPartyDetails?: string;
}
export interface OrderSearchEntity {
    orderAmount: number;
    orderRefNumber: string;
    sbiOrderRefNumber?: string;
    atrnNumber?: string;
}
/**
 * Refund Types
 */
export interface RefundEntity {
    refundType: string;
    refundAmount: number;
    atrnNumber: string;
    remark?: string;
}
export interface RefundSearchEntity {
    atrnNumber: string;
    arrnNumber: string;
    sbiOrderRefNumber: string;
    refundStatus: string;
    refundType: string;
    from: number;
    to: number;
}
