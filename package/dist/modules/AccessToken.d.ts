/**
 * This class handles access token /token/access API endpoint.
 */
import { AxiosInstance } from 'axios';
export declare class AccessToken {
    private api;
    /**
     * Creates an instance of the Access Token.
     * @param {AxiosInstance} apiClient - Axios instance for API handle.
     */
    constructor(apiClient: AxiosInstance);
    /**
     * Get access token.
     * @returns {Promise<any>} A promise that resolves to the created customer entity.
     */
    getToken(): Promise<any>;
}
