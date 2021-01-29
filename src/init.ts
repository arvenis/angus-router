import * as Express from 'express';
import _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';

import OpenAPIRequestValidator from 'openapi-request-validator';
import OpenAPIResponseValidator from 'openapi-response-validator';
import { OpenAPI, OpenAPIV3 } from 'openapi-types';
import * as util from './tools/util';

import { CONST, FabricConfig, FabricService, FCustomHandler, AngusError } from './tools/common';
import { APIDefinition } from './tools/apidefinition';
import { ChaincodeInventory } from './tools/chaincodeinventory';

import { getLogger } from './tools/logger';
import { Config } from './tools/config';
const logger = getLogger(__filename);

export function initialize() {
    logger.debug("Initialize gateway....")
    logger.debug("Initialization finished.")
}