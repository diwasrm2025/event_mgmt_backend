/**
 * Refunds resource.
 * This class handles all interactions with the /refunds API endpoint.
 */
import { AxiosInstance } from 'axios';
import { ResponseEntity } from '../types';
import { Api } from '../utils/services';
export declare class Refund extends Api {
    /**
     * Creates an instance of the Refund.
     * @param {AxiosInstance} apiClient - Axios instance for API handle.
     * @param {string} encryptionKey - Encryption key for handle request/response encryption/decryption.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(apiClient: AxiosInstance, encryptionKey: string, logging: boolean, responseType: string);
    /**
     * Book a refund.
     * @param {any} payload - The data for book refund.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the created refund entity.
     */
    book(payload: any): Promise<ResponseEntity>;
    /**
     * Fetches a specific refund by its ID.
     * @param {any} payload - The payload of the refund.
     * @param {number} page - pagination page number.
     * @param {number} size - pagination page contain number of rows.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the fetched refund entity.
     */
    search(payload: any, page?: number, size?: number): Promise<ResponseEntity>;
}
