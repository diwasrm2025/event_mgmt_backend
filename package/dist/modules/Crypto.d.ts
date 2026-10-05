export declare class Crypto {
    private encryptionKey;
    protected logging: boolean;
    protected responseType: string;
    /**
     * Creates an instance of the Crypto.
     * @param {string} encryptionKey - Encryption key for handle request/response encryption/decryption.
     * @param {boolean} logging - Enable/Disable API logs.
     * @param {string} responseType - Data convert to JSON/Stringify enable/disable.
     */
    constructor(encryptionKey: string, logging: boolean, responseType: string);
    /**
     * Encrypt payload.
     * @param {any} payload - The data for encryption.
     * @returns {Promise<any>} A promise that resolves to the encrypted payload.
     */
    encrypt(payload: any): Promise<any>;
    /**
     * Decrypt payload.
     * @param {any} payload - The data for decryption.
     * @returns {Promise<any>} A promise that resolves to the decrypted payload.
     */
    decrypt(payload: any): Promise<any>;
    /**
     * Decode payload.
     * @param {any} payload - The data for decoding.
     * @returns {Promise<any>} A promise that resolves to the decoded payload.
     */
    decodeCallback(payload: any): Promise<any>;
}
