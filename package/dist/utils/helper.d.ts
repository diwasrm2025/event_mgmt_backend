/**
 * Enable/Disable console logs
 * @param {boolean} isLog - Enable/Disable logs.
 * @param {string} title - Log title.
 * @param {any} data - log data.
 */
export declare const logger: (isLog: boolean, title: string, data: any) => void;
/**
 * Exception handling
 * @param {number} errorCode - Error codes.
 * @param {string} errorMessage - Error message.
 * @param {any} data - Error data.
 */
export declare const sbiException: (errorCode: number, statusCode: number, errorMessage: string, data?: any) => {
    status: number;
    errors: {
        errorCode: number;
        errorMessage: string;
    }[];
};
