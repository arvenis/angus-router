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

export async function initialize() {
    logger.info("Initialize gateway....")
    logger.debug("Checking admin enrollment..")
    let _registrarId = "admin"
    try {
        if (!(await util.isWalletExists(_registrarId))) {
            logger.info(`Admin wallet for registrar ${_registrarId} doesn't exist, yo have to enroll it.`);
          }
    } catch (error) {
        logger.error(error);
        return error;
    }

    logger.debug("Initialization finished.")
}