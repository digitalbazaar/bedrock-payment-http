/**!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const {PaymentStatus} = require('bedrock-payment');
const {schemas} = require('bedrock-validation');

const numericFloat = '^[0-9]+(\\.[0-9]{0,2})?$';
const paymentEnum = Object.values(PaymentStatus);
// this is used by the validator to ensure you
// can not post a service not supported by the current project.
const servicesEnum = config.bedrock_payment.services || [];

const _payment = ({required}) => ({
  title: 'Bedrock Payment',
  type: 'object',
  required,
  additionalProperties: false,
  properties: {
    id: {
      title: 'id',
      type: 'string',
    },
    amount: {
      title: 'amount',
      type: 'string',
      pattern: numericFloat
    },
    currency: {
      title: 'currency',
      type: 'string'
    },
    creator: {
      title: 'creator',
      type: 'string'
    },
    validated: {
      title: 'validated',
      anyOf: [{type: 'boolean'}, {type: 'null'}]
    },
    service: {
      title: 'service',
      name: 'service',
      type: 'string',
      enum: servicesEnum
    },
    serviceId: {
      title: 'serviceId',
      type: 'string'
    },
    status: {
      title: 'status',
      type: 'string',
      enum: paymentEnum
    },
    error: {
      title: 'error',
      anyOf: [{type: 'object'}, {type: 'null'}]
    },
    orders: {
      title: 'orders',
      type: 'array',
      minItems: 1
    },
    created: schemas.w3cDateTime()
  }
});

const all = [
  'id', 'amount', 'currency', 'creator', 'validated',
  'service', 'serviceId', 'status', 'error', 'orders', 'created'
];

const creating = () => ({
  type: 'object',
  required: ['payment'],
  additionalProperties: false,
  properties: {
    payment: _payment({required: ['amount', 'orders']})
  }
});

const processing = () => ({
  type: 'object',
  // order is optional and make contain gateway specific details.
  required: ['payment'],
  additionalProperties: false,
  properties: {
    payment: _payment({required: all}),
    order: {
      title: 'order',
      anyOf: [{type: 'object'}, {type: 'array'}, {type: 'null'}]
    }
  }
});

module.exports = {creating, processing};
