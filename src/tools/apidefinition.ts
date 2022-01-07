// tslint:disable no-identical-functions
import SwaggerParser from '@apidevtools/swagger-parser';
import _ from 'lodash';
import { OpenAPI, OpenAPIV3 } from 'openapi-types';
import { AngusError, CONST } from './common';
import { Config } from './config';
import { getLogger } from './logger';



const logger = getLogger(__filename);

// tslint:disable-next-line: no-namespace
export namespace APIDefinition {
  let _apiDefinition: OpenAPI.Document;

  export async function createInstance() {
    try {
      logger.debug('Creating OpenAPI definition...');
      _apiDefinition = await SwaggerParser.validate(Config.getConfigItem("openapi_file"), { validate: { schema: false } });
      logger.info('OpenAPI definition loaded.');
    } catch (error) {
      logger.error(error);
    }
  }

  export function getApiDefinition(): OpenAPI.Document {
    return _apiDefinition;
  }

  function checkConfig(path: string, method?: string): boolean {
    const _path = _apiDefinition.paths[path];

    // Checking whether the endpoint is exist in the configuration
    if (_.isUndefined(_path)) {
      throw new AngusError(`${path} endpoint is missing from openApi configuration`);
    }

    // Checking whether the endpoint contains the specified method
    if (!_.isUndefined(method) && !_.has(_path, method.toLowerCase())) {
      logger.error(`${path} endpoint has no ${method} method`);
      throw new AngusError(`${path} endpoint has no ${method} method`);
    }

    // Checking whether the enpoint contains the configuration parameter
    if (!_.has(_path, CONST.CONFIG_TAG)) {
      throw new AngusError(`${CONST.CONFIG_TAG} is not found for ${path}`);
    }
    return true;
  }

  export function getParameters(path: string, method: string): OpenAPI.Parameters {
    if (checkConfig(path, method)) {
      return _apiDefinition.paths[path][method.toLowerCase()].parameters;
    } else {
      return null;
    }
  }

  export function getRequestBody(path: string, method): OpenAPIV3.RequestBodyObject {
    if (checkConfig(path, method)) {
      return _apiDefinition.paths[path][method.toLowerCase()].requestBody;
    } else {
      return null;
    }
  }

  export function getFabricConfig(path: string): string[] {
    if (checkConfig(path)) {
      return _apiDefinition.paths[path][CONST.CONFIG_TAG];
    }
    return null;
  }

  export function getCustomHandler(path: string): string {
    if (checkConfig(path)) {
      return _apiDefinition.paths[path][CONST.CUSTOM_HANDLER_TAG];
    }
    return null;
  }

  export function getResponses(path: string, method: string): OpenAPIV3.ResponsesObject {
    if (checkConfig(path, method)) {
      return _apiDefinition.paths[path][method.toLowerCase()].responses;
    }
    return null;
  }
}
