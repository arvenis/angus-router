import * as Express from 'express';
import * as fs from 'fs';
import _ from 'lodash';
import OpenAPIRequestValidator from 'openapi-request-validator';
import OpenAPIResponseValidator from 'openapi-response-validator';
import { OpenAPI, OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import { APIDefinition } from './tools/apidefinition';
import { ChaincodeInventory } from './tools/chaincodeinventory';
import { AngusError, CONST, FabricConfig, FabricService, FCustomHandler } from './tools/common';
import { Config } from './tools/config';
import { getLogger } from './tools/logger';
import * as util from './tools/util';



const logger = getLogger(__filename);

export async function validateInputParameters(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  try {
    logger.debug(`Validating ${req.path} parameters based on OpenAPI definition...`);
    if (_.eq(req.path, "/api-docs/openapi.yaml")) {
      logger.debug ("Return parsed OpenAPI definition");
      res.json(APIDefinition.getApiDefinition());
      return;
    }

    const validator: OpenAPIRequestValidator = new OpenAPIRequestValidator({
      parameters: APIDefinition.getParameters(req.path, req.method),
      requestBody: APIDefinition.getRequestBody(req.path, req.method)
    });

    const errors = validator.validate(req);

    if (!_.isUndefined(errors)) {
      logger.error(`Validating ${req.path} parameters failed`);
      logger.warn(JSON.stringify(errors));
      next(errors);
    } else {
      logger.debug(`Validating ${req.path} parameters: success`);
      next();
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
}

export async function handleRequest(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  const _parameters: OpenAPI.Parameters = APIDefinition.getParameters(req.path, req.method);
  const _requestBody: OpenAPIV3.RequestBodyObject = APIDefinition.getRequestBody(req.path, req.method);

  let _serviceParams: object = {};

  try {
    // Transforming parameters from URL
    _.forEach(_parameters, (p: OpenAPIV3.ParameterObject) => {
      if (_.eq(p.in, 'query')) {
        _serviceParams[p.name] = req.query[p.name];
      }
    });

    // Transforming parameters from request body
    if (!_.isUndefined(_requestBody)) {
      _serviceParams = req.body;
    }

    // Get Inventory services
    const _fabricConfig: FabricConfig[] = ChaincodeInventory.getInventoryItems(APIDefinition.getFabricConfig(req.path));
    if (_.isEmpty(_fabricConfig)) {
      throw new Error(`No config found for ${req.path}`);
    }

    // Fill Fabric service object
    const _fabricService: FabricService = {
      customerId: req.get(CONST.HEADER_USERID),
      serviceParams: JSON.stringify(_serviceParams),
      fabricServices: _fabricConfig
    };

    // Get custom handler
    const _customHandler: string = APIDefinition.getCustomHandler(req.path);
    let retval: any = {};

    if (!_.isNil(_customHandler)) {
      let _mPath: string;
      // Custom handler has been defined
      if (fs.existsSync(path.join(__dirname, "module", req.path) + '.js') ) {
        // Check built-in custom handler (module folder)
        _mPath=path.join(__dirname, "module", req.path);
        logger.debug(`Start built-in customHandler: ${_mPath}:${_customHandler}`);

      } else if (
        fs.existsSync(path.join(Config.getConfigItem("module_dir"), req.path)+ '.js') // .JS file
      ) {
        // Check external custom handler
        _mPath = path.join(Config.getConfigItem("module_dir"), req.path);
        logger.debug(`Start external customHandler in ${_mPath}:${_customHandler}`);

      } else {
        throw new AngusError(`Specified customHandler ${_customHandler} not found in module path`);
      }

      const fn_customHandler: FCustomHandler = require(_mPath)[_customHandler];

      retval = await fn_customHandler(_fabricService, req, res, next);
    } else {
      // Default handler
      logger.debug(`Start default handler`);
      retval = await util.processTransaction(_fabricService);
    }
    req.res = retval;
    next();
  } catch (error) {
    logger.error(error);
    next(error);
  }
}

export async function validateResponse(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  try {
    logger.debug(`Validating ${req.path} response based on OpenAPI definition...`);

    const validator: OpenAPIResponseValidator = new OpenAPIResponseValidator({
      responses: APIDefinition.getResponses(req.path, req.method)
    } as any);

    const errors = validator.validateResponse(200, req.res);

    if (!_.isUndefined(errors)) {
      logger.error(`Validating ${req.path} response failed`);
      logger.warn(`${errors.message} ${errors.errors[0].message}`);
      logger.warn(JSON.stringify(req.res, null, 2));
      next(errors);
    } else {
      logger.debug(`Validating ${req.path} response: success`);
      res.json(req.res);
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
}

export async function errorHandler(err: any, req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (err.status) {
    try {
      logger.debug(`Validating ${req.path} error response based on OpenAPI definition...`);

      const validator: OpenAPIResponseValidator = new OpenAPIResponseValidator({
        responses: APIDefinition.getResponses(req.path, req.method)
      } as any);

      const errors = validator.validateResponse(err.status, err);

      if (errors) {
        logger.error(`Validating ${req.path} error response failed`);
        logger.warn(`${errors.message}`);
        logger.warn(JSON.stringify(err, null, 2));
        return res.status(500).json(errors);
      } else {
        logger.debug(`Validating ${req.path} error response: success`);
        return res.status(err.status).json(err);
      }
    } catch (error) {
      logger.error(error);
      return res.status(500).json(error);
    }
  }
  res.status(500).json(err);
}
