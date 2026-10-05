/**
 * Encrypt a value using AES-GCM.
 * @param {string} key - The key for encryption.
 * @param {any} value - The plaintext value to encrypt.
 * @returns {Promise<string>} - Base64 encoded ciphertext with IV prepended.
 */
export declare function encrypt(key: string, value: any): Promise<string>;
/**
 * Decrypt a value using AES-GCM.
 * @param {string} key - The key used for AES-GSM decryption.
 * @param {string} encryptedBase64 - Base64 encoded ciphertext with IV prepended.
 * @returns {Promise<any>} - The decrypted plaintext value.
 */
export declare function decrypt(key: string, encryptedBase64: string): Promise<any>;
