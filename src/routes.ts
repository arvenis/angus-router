import bodyParser from 'body-parser';
import * as Express from 'express';
import _ from 'lodash';

import * as swaggerUI from 'swagger-ui-express';
import { errorHandler, handleRequest, validateInputParameters, validateResponse } from './handler';
import { APIDefinition } from './tools/apidefinition';
import { ChaincodeInventory } from './tools/chaincodeinventory';
import { initialize } from './init'

/**
 * Express API entry point
 *
 * @param gatewayExpressApp
 *
 */

export default async function(gatewayExpressApp: Express.Application) {
  gatewayExpressApp.use(bodyParser.json());
  gatewayExpressApp.use(bodyParser.urlencoded({ extended: true }));
  await APIDefinition.createInstance();
  ChaincodeInventory.createInstance();
  // Initialize needed accounts
  initialize()

  // OpenAPI documentaion
  gatewayExpressApp.use('/api-docs', swaggerUI.serve);
  gatewayExpressApp.get('/api-docs', swaggerUI.setup(APIDefinition.getApiDefinition()));

  // Validate input parameters
  gatewayExpressApp.use(validateInputParameters);
  // Handle requests
  gatewayExpressApp.use(handleRequest);
  // Validate response object
  gatewayExpressApp.use(validateResponse);
  // Validate errors
  gatewayExpressApp.use(errorHandler);
}
