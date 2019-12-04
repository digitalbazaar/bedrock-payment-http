## 0.0.1 -

### Added
- lib/schemas/payment.js with validators for processing and creating payments.
- lib/index.js which sets up the configurable payment endpoints.
- Adds a config module that defaults the basePath to /payment.
- Adds a route GET /payment/credentials for payment api keys / auth.
- Adds a route GET /payment for getting all payments.
- Adds a route POST /payment for creating a new payment.
- Adds a route POST /payment/:paymentId for processing a new payment. 
