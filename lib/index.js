/**!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const {validate} = require('bedrock-validation');
const {asyncHandler} = require('bedrock-express');
const paymentService = require('bedrock-payment');
const logger = require('./logger');

require('./config.js');

const {PaymentStatus, Errors} = paymentService;

const {ensureAuthenticated} = brPassport;
const {config} = bedrock;
const {BedrockError} = bedrock.util;

bedrock.events.on('bedrock-express.configure.routes', app => {
  const cfg = config['payment-http'];
  const {basePath: PAYMENT_ENDPOINT} = cfg.routes;
  // GET /payment/credentials
  // GET the api keys/ auth tokens necessary to implement charges client side.
  app.get(
    `${PAYMENT_ENDPOINT}/credentials`,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      const {service} = req.query;
      if(!service) {
        throw new BedrockError(
          'You must provide a service in the query.', Errors.Syntax);
      }
      // this will throw if the credential is not found.
      const data = await paymentService.getGatewayCredentials({service});
      return res.status(200).json(data);
    })
  );

  // GET /payment
  // GET all payments for an account.
  app.get(
    PAYMENT_ENDPOINT,
    ensureAuthenticated,
    asyncHandler(async (req, res) => {
      // this is so a authenticated account can not request
      // another account's payments.
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
      logger.debug('create payment called', {paymentData});
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
      if(pendingPayments.length > 0) {
        logger.debug('updating payment', {creator, paymentData});
        // this is where most of the concurrency issues appear.
        const {updatedOrder, payment} = await paymentService.
          updatePendingPayment({pendingPayments, paymentData});
        return res.status(200).json({order: updatedOrder, payment});
      }
      logger.debug('creating new payment', {creator, paymentData});
      // FIXME remove this try/catch before PR or leave a comment.
      // this is mostly for debugging and block BedrockErrors from returning.
      // NOTE: this is being left in for the PR so refactor of bedrock-payments
      // is easier.
      try {
        const {order, payment} = await paymentService.createPayment(
          {creator, paymentData});
        return res.status(201).json({order, payment});
      } catch(e) {
        logger.error('FAILED TO CREATE PAYPAL ORDER ERROR', {error: e});
        res.sendStatus(500);
      }
    }));

  // PUT /payment/:paymentId.
  // Processes an existing payment.
  app.put(
    `${PAYMENT_ENDPOINT}/:paymentId`,
    ensureAuthenticated,
    validate({body: 'payment.processing'}),
    asyncHandler(async (req, res) => {
      logger.debug('process payment called', {body: req.body});
      const {id: account} = req.user.account;
      const creator = account;
      const {payment: paymentData, order = null} = req.body;
      // get the payment
      const payment = await paymentService.db.findOne(
        {query: {id: paymentData.id, creator}});
      if(!payment) {
        throw new BedrockError(
          'Payment not found',
          Errors.NotFound,
          {httpStatusCode: 404, public: true});
      }
      // this throws a BedrockError if the payment is already finished.
      // It has to be called before we make any change to the payment status.
      paymentService.finished({payment});
      payment.status = PaymentStatus.PROCESSING;
      await paymentService.db.save({payment});
      const verifiedPurchase = await paymentService.process({payment, order});
      // if we could not find a verifiedPurchase on the gateway
      // then mark the payment as VOIDED.
      if(!verifiedPurchase) {
        payment.status = PaymentStatus.VOIDED;
        await paymentService.db.save({payment});
        throw new BedrockError('Payment voided.', Errors.Data, {public: true});
      }
      logger.debug('verifiedPurchase', {verifiedPurchase});
      const {orderProcessor} = config.bedrock_payment;
      // this will throw an error if the verifiedPurchase
      // is not equal to the plan's amount.
      // it will also throw if the orderProcessor name is set incorrectly.
      const orderService = paymentService.order.get({id: orderProcessor});
      const orderConfirmed = await orderService.process(
        {payment, verifiedPurchase, order});
      return res.status(200).json(orderConfirmed);
    })
  );

});
