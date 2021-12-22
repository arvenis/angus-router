import express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as url from 'url';
import routes from './routes';
import { FabricConfig, FabricService } from './tools/common';
import { Config } from './tools/config';
import { getLogger } from './tools/logger';
import * as util from './tools/util';


// tslint:disable-next-line: no-var-requires
const gateway = require('express-gateway');


const logger = getLogger(__filename);

/**
 * Starts the API gateway module
 *
 */
function startGateway() {
  gateway()
    .load(Config.getConfigItem("config_dir"))
    .run();
}

/**
 * Starts the API backend module
 *
 */
function startGatewayBackend() {
  const gw_config = yaml.safeLoad(fs.readFileSync(path.join(Config.getConfigItem("config_dir"), 'gateway.config.yml'), 'utf8'));
  const _url = new url.URL(gw_config.serviceEndpoints.fabric.url);
  const be = express();
  routes(be);
  be.listen(_url.port, () => logger.info(`Angus router listening on port ${_url.port}`));
}

export class AngusRouter {
  constructor(configFile?: string) {
    // Create configuration settings
    Config.createInstance(process.env.CONFIG_FILE || configFile );
  }

  start() {
    // Start express gateway
    setImmediate(() => startGateway());
    // Start Angus Router
    setImmediate(() => startGatewayBackend());
  }
}

export async function processTransaction(params: FabricService, config?: FabricConfig): Promise<any> {
  return await util.processTransaction(params, config);
}
