# bedrock-payment-http


> Provides the HTTP APIs for bedrock-payment.

Inserts a set of API endpoints into a bedrock server that can securely process payments.

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Security
Bedrock Payment HTTP provides API endpoints for payments that require a user is logged in. Additional checks are made to ensure that the payment being processed was created by the account in the current session.

## Background
Bedrock Payment HTTP was created in order to provide an easy to use and secure API for payments from multiple payment gateways (i.e. paypal, stripe, etc.).

## Install

```sh
npm install bedrock-payment-http --save
```

## Usage
You can configure bedrock-payment-http by requiring a config file like this

```js
const bedrock = require('bedrock');
const path = require('path');

const {config} = bedrock;
const cfg = config['payment-http'];

const basePath = '/payment';

cfg.routes = {
  basePath
};
```

## API
This module adds several new API endpoints to your bedrock server.
the basePath defaults to /payment

### GET /payment/credentials?service=foo

Gets the credentials needed for client side charges.

  * Response codes:
     * 200: Credentials were found.
     * 404: Credentials not found.
     * 500: Server failure.


### GET /payment

Gets all payments for the currently logged in account.

  * Response codes:
     * 200: Request succeeded.
     * 500: Server failure.

### POST /payment

Creates or updates a pending payment.

  * Response codes:
     * 200 Payment Update Request succeeded.
     * 201 Payment Create Request succeeded.
     * 404 Payment not found.
     * 500 Server failure.

### PUT /payment/:paymentID

Processes a Payment.

  * Response codes:
    * 200 Payment Process succeeded.
    * 404 Payment not found.
    * 500 Server failure.

## Maintainers

[@DigitalBazaar](https://github.com/DigitalBazaar)

## Contributing

See [the Bedrock contributing file](https://github.com/digitalbazaar/bedrock/blob/master/CONTRIBUTING.md)!

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

Bedrock © 2019 DigitalBazaar
