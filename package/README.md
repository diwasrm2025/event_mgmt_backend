# SBI Epay NodeJS SDK

Official NodeJS bindings for the [EPay API]

## Requirements

NodeJS v20.18.0 or later

Mock Tests Support till NodeJS v20.18.0

## Installation

Install this dependency to your project:

```groovy
npm install epay_nodejs_sdk
```

## Usage
`SBIEPayClient` can be instantiated like below:

### Using Private Auth
To instantiate `SBIEPayClient`:
Create SBI ePay client with merchant user provided credentials.

```javascript
const {SBIEPayClient} = require("epay_nodejs_sdk");

const sbiePayClient = new SBIEPayClient({
    apiKey: string,
    apiSecret: string,
    encryptionKey: string,
}, environment: 'LIVE' | 'SANDBOX', logging: boolean, responseType: 'JSON' | 'STRING');
//logging is optional, default false
//responseType is optional, default 'JSON'
```
Parameter logging is optional, default false.

Parameter responseType is optional, default 'JSON'.

### Example
```javascript
const {SBIEPayClient} = require("epay_nodejs_sdk");

const sbiePayClient = new SBIEPayClient({
    apiKey: "VBZznwItxzwMlSsLaR0wvw==",
    apiSecret: "Pj9F5Q7FpUxjgvCVMAxM51lMx4kweUz3r6r8uHEOhtE=",
    encryptionKey: "Qj9F5P7GpCxjgvBHSAxL93lTx4kweUz3r6r8uBOZXhtE=",
}, 'SANDBOX', true, 'STRING');

const requestBody = {};
const response = await sbiePayClient.order.create(requestBody);
```
You have to pass logging parameter is mandatory, if you want pass responseType parameter.

## API listing

- [Customer](documents/Customer.md)
- [Order](documents/Order.md)
- [Refund](documents/Refund.md)
- [Crypto](documents/Crypto.md)
