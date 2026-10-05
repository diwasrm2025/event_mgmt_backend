/**
 * Decrypt data function.
 * @param {string} hVal - Encryption key for decrypt data.
 * @param {any} payload - Encrypted data.
 * @param {string} responseType - Response type JSON/STRING.
 * @returns {Promise<any>} A promise that resolves to the decrypt data.
 */
export declare const decryptPayload: (hVal: string, payload: any, responseType: string, logging: boolean) => Promise<any>;
