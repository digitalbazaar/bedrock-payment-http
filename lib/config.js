/**!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const path = require('path');
require('bedrock-validation');

const {config} = bedrock;
const namespace = 'payment-http';
const cfg = config[namespace] = {};

const basePath = '/payment';

cfg.routes = {
  basePath
};

config.validation.schema.paths.push(path.join(__dirname, 'schemas'));
