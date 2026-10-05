/**
 * customers resource.
 * This class handles all interactions with the /customers API endpoint.
 */
import { AxiosInstance } from 'axios';
import { ResponseEntity } from '../types';
import { Api } from '../utils/services';
export declare class Customer extends Api {
    /**
     * Creates an instance of the Customer.
     * @param {AxiosInstance} apiClient - Axios instance for API handle.
     * @param {string} encryptionKey - Encryption key for handle request/response encryption/decryption.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(apiClient: AxiosInstance, encryptionKey: string, logging: boolean, responseType: string);
    /**
     * Creates a new customer.
     * @param {any} payload - The data for creating the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the created customer entity.
     */
    create(payload: any): Promise<ResponseEntity>;
    /**
     * Fetches a specific customer by its ID.
     * @param {string} customerId - The unique identifier of the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the fetched customer entity.
     */
    get(customerId: string): Promise<ResponseEntity>;
    /**
     * Update status of a specific customer by its ID.
     * @param {string} customerId - The unique identifier of the customer.
     * @param {string} status - The status of the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the update customer entity.
     */
    private updateStatus;
    /**
     * Activate specific customer by its ID.
     * @param {string} customerId - The unique identifier of the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the Activate customer entity.
     */
    active(customerId: string): Promise<ResponseEntity>;
    /**
     * Inactivate specific customer by its ID.
     * @param {string} customerId - The unique identifier of the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the Inactivate customer entity.
     */
    inactive(customerId: string): Promise<ResponseEntity>;
    /**
     * Delete specific customer by its ID.
     * @param {string} customerId - The unique identifier of the customer.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the Delete customer entity.
     */
    delete(customerId: string): Promise<ResponseEntity>;
}
