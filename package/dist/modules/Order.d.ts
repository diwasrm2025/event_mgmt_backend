/**
 * Orders resource.
 * This class handles all interactions with the /orders API endpoint.
 */
import { AxiosInstance } from 'axios';
import { ResponseEntity } from '../types';
import { Api } from '../utils/services';
export declare class Order extends Api {
    /**
     * Creates an instance of the Order.
     * @param {AxiosInstance} apiClient - Axios instance for API handle.
     * @param {string} encryptionKey - Encryption key for handle request/response encryption/decryption.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(apiClient: AxiosInstance, encryptionKey: string, logging: boolean, responseType: string);
    /**
     * Creates a new order.
     * @param {any} payload - The data for creating the order.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the created order entity.
     */
    create(payload: any): Promise<ResponseEntity>;
    /**
     * Search orders by search payload.
     * @param {any} payload - The search payload of the order.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the fetched order entity.
     */
    search(payload: any): Promise<ResponseEntity>;
    /**
     * Search order by settled order by search payload.
     * @param {any} payload - The search payload of the order.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the fetched order entity.
     */
    settledOrders(payload: any, page?: number, size?: number): Promise<ResponseEntity>;
    /**
     * Search order by transaction success by search payload.
     * @param {any} payload - The search payload of the order.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the fetched order entity.
     */
    transactionOrders(payload: any, page?: number, size?: number): Promise<ResponseEntity>;
}
