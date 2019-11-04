const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {validate} = require('bedrock-validation');
const asyncHandler = require('express-async-handler');
const paymentService = require('../bedrock-payment');
const logger = require('./logger');

require('./config.js');

const {PaymentStatus, Errors} = paymentService;

const {ensureAuthenticated} = brPassport;
const {config} = bedrock;
const {BedrockError} = bedrock.util;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['payment-http'];
  const {basePath: PAYMENT_ENDPOINT} = cfg.routes;
  // GET /payment/meta
  // GET the meta-data necessary to implement charges client side.
  app.get(
    `${PAYMENT_ENDPOINT}/credentials`,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {service} = req.query;
      if(!service) {
        throw new BedrockError(
          'You must provide a service in the query', Errors.Data);
      }
      logger.info(`Getting ${service} credentials`);
      const data = await paymentService.getGatewayCredentials({service});
      if(!data) {
        throw new BedrockError(
          `No Credentials Found for ${service}`, Errors.Data);
      }
      return res.status(200).json(data);
    })
  );

  // GET /payment
  // GET all payments for an account.
  app.get(
    PAYMENT_ENDPOINT,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      // this is so a user can not request
      // another user's payments.
      const {id: creator} = req.user.account;
      // check for existing Payments.
      const query = {creator};
      const payments = await paymentService.db.findAll({query});
      return res.status(200).json(payments);
    })
  );

  // POST /payment
  // Creates a new Payment.
  // The client will need to post the payment they intend to use.
  app.post(
    PAYMENT_ENDPOINT,
    ensureAuthenticated,
    validate({body: 'payment.creating'}),
    asyncHandler(async (req, res) => {
      const {id: creator} = req.user.account;
      const {payment: paymentData} = req.body;
      logger.debug('CREATE PAYMENT CALLED', {paymentData});
      // FIXME implement a payment schema validator.
      if(!paymentData) {
        throw new BedrockError(
          'Missing Payment Data for order.',
          Errors.Data,
          {httpStatusCode: 400});
      }
      const processingPayments = await paymentService.db.findAll(
        {query: {creator, status: PaymentStatus.PROCESSING}});
      // this can cause issues if a payment fails while processing.
      if(processingPayments.length > 0) {
        throw new BedrockError(
          'Can not create a new payment if you have processing payments.',
          Error.Constraint, {httpStatusCode: 409, public: true});
      }
      // check for existing pending Payments.
      const pendingPayments = await paymentService.db.findAll(
        {query: {creator, status: PaymentStatus.PENDING}});
      // FIXME this is a concurrency problem.
      // If 2 or more users try to create a payment at the same time
      // we could have 2 pendingPayments. Maybe we should merge them?
      if(pendingPayments.length > 1) {
        // 409 Conflict
        throw new BedrockError(
          'Can not create a new payment if more than 1 PENDING payments exist.',
          Error.Constraint, {httpStatusCode: 409, public: true});
      }
      if(pendingPayments.length === 1) {
        // this is where most of the concurrency issues appear.
        const {updatedOrder, payment} = await paymentService.
          updatePendingPayment({pendingPayments, paymentData});
        return res.status(200).json({order: updatedOrder, payment});
      }
      logger.debug('CREATING NEW PAYMENT', {creator, paymentData});
      // FIXME remove this try/catch before PR or leave a comment.
      // this is mostly for debugging.
      try {
        const {order, payment} = await paymentService.createPayment(
          {creator, paymentData});
        return res.status(201).json({order, payment});
      } catch(e) {
        logger.error('FAILED TO CREATE PAYPAL ORDER ERROR', {error: e});
      }
    }));

  // POST /payment/:paymentId.
  // Processes an existing payment.
  app.post(
    `${PAYMENT_ENDPOINT}/:paymentId`,
    ensureAuthenticated,
    validate({body: 'payment.processing'}),
    asyncHandler(async (req, res) => {
      logger.debug('PROCESS PAYMENT CALLED', {body: req.body});
      const {id: account} = req.user.account;
      const creator = account;
      const {payment: paymentData, order = null} = req.body;
      // FIXME implement a payment schema validator.
      if(!paymentData) {
        throw new BedrockError(
          'Missing Payment',
          Errors.Data,
          {httpStatusCode: 400});
      }
      // get the payment
      const payment = await paymentService.db.findOne(
        {query: {id: paymentData.id}});
      if(!payment) {
        throw new BedrockError(
          'Payment not found',
          Errors.NotFound,
          {httpStatusCode: 400, public: true});
      }
      // this throws a BedrockError if the payment is already finished.
      // It has to be called before we make any change to the payment status.
      paymentService.finished({payment});
      payment.status = PaymentStatus.PROCESSING;
      paymentService.db.save({payment});
      if(payment.creator !== creator) {
        throw new BedrockError('Payment created by another account',
          Errors.NotAllowed, {httpStatusCode: 401, public: true});
      }
      // this throws a NOT FOUND error.
      const verifiedPurchase = await paymentService.process({payment, order});
      if(!verifiedPurchase) {
        payment.status = PaymentStatus.VOIDED;
        await paymentService.db.save({payment});
        throw new BedrockError('Payment voided.', Errors.Data, {public: true});
      }
      logger.debug('verifiedPurchase', {verifiedPurchase});
      // this will throw an error if the verifiedPurchase
      // is not equal to the plan's amount.
      const orderService = paymentService.order.get({id: 'plans'});
      const orderConfirmed = await orderService.process(
        {payment, verifiedPurchase, order});
      return res.status(200).json(orderConfirmed);
    })
  );

});
