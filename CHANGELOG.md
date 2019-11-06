## 0.0.1 -

### Added
  - lib/schemas/payment.js with validators for processing and creating payments.
  - lib/index.js which sets up the configurable payment endpoints.
  - Adds a route GET basePath/credentials for payment api keys / auth.
  - Adds a route GET basePath/ for getting all payments.
  - Adds a route POST basePath/ for creating a new payment.
  - Adds a route POST basePath/:paymentId for processing a new payment. 
