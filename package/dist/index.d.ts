import { SDKCredentials } from './types';
import { Customer } from './modules/Customer';
import { Order } from './modules/Order';
import { Refund } from './modules/Refund';
import { Crypto } from './modules/Crypto';
/**
 * The main class for the SBI ePay SDK.
 * Users will instantiate this class to interact with the API.
 */
export declare class SBIEPayClient {
    private apiClient;
    customer: Customer;
    order: Order;
    refund: Refund;
    crypto: Crypto;
    /**
     * Creates an instance of the SBIEPayClient SDK.
     * @param {SDKCredentials} credentials - The credentials for the SDK.
     * @param {'LIVE' | 'SANDBOX'} environment - SDK environment.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(credentials: SDKCredentials, environment: 'LIVE' | 'SANDBOX', logging?: boolean, responseType?: string);
}
export * from './types';
