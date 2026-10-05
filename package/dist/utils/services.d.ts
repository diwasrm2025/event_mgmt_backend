/**
 * API resource.
 * This class handles all interactions with the API methods.
 */
import { AxiosInstance } from 'axios';
import { ResponseEntity } from '../types';
export declare class Api {
    private api;
    private accessToken;
    private encryptionKey;
    protected logging: boolean;
    protected responseType: string;
    /**
     * Creates an instance of the API.
     * @param {AxiosInstance} apiClient - Axios instance for API handle.
     * @param {string} encryptionKey - Encryption key for handle request/response encryption/decryption.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(apiClient: AxiosInstance, encryptionKey: string, logging: boolean, responseType: string);
    /**
    * Add access token to Request header authorization.
    */
    protected updateInstance(): Promise<void>;
    /**
     * POST API Request.
     * @param {string} url - The url for POST API request.
     * @param {any} payload - The payload for POST API request.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the POST API request.
     */
    protected _post(url: string, payload?: any): Promise<ResponseEntity>;
    /**
     * GET API Request.
     * @param {string} url - The url for GET API request.
     * @returns {Promise<ResponseEntity>} A promise that resolves to the GET API request.
     */
    protected _get(url: string): Promise<ResponseEntity>;
}
