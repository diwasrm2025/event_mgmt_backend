/**
 * Encrypt data function.
 * @param {string} hVal - Encryption key for decrypt data.
 * @param {any} payload - Decrypted data.
 * @returns {Promise<any>} A promise that resolves to the encrypt data.
 */
export declare const encryptPayload: (hVal: string, payload: any, logging: boolean) => Promise<any>;
