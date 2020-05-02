import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import * as path from 'path';
import * as os from 'os';


import { getLogger } from './logger';
const logger = getLogger(__filename);

const DEFAULT_CONFIG = {
    "config_dir": path.join(path.dirname(__dirname), "config"),
    "wallet_dir": path.join(path.dirname(__dirname), "wallet"),
    "components_dir": path.join(path.dirname(__dirname), "config"),
    "module_dir": path.join(path.dirname(__dirname), "module"),
    "connection_file": path.join(os.homedir(), '.angus', 'profiles','default.yaml'),
    "openapi_file": path.join(path.dirname(__dirname), 'config', 'openapi', 'openapi.yaml'),
    "inventory_file": path.join(path.dirname(__dirname), 'config', 'chaincode.inventory.yaml')
}

export namespace Config {
    //TODO: Make type
    let config: any;

    export function getConfigItem(key: string): string   {
        return config[key];
    }

    export function createInstance(configFile?: string) {
        config = _.clone(DEFAULT_CONFIG);
        if (!_.isUndefined(configFile)) {

            try {
                let _config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
                _.assign (config, _config.config);
                
            } catch (exception) {
                logger.debug(exception);
                logger.warn(`Invalid or missing config file, using defaults (${configFile})`);
                config=DEFAULT_CONFIG;
            }    
        }

        _.forEach(config, (value, key) => {
            if (key.endsWith('dir')) {
                if (!path.isAbsolute(value)) {
                    config[key] = path.resolve(path.dirname(configFile), value);
                }
            }
            let _s = process.env[key.toUpperCase()];
            if (!_.isUndefined(_s)) {
                logger.debug(`Using env: ${key}: ${_s}`)
                config[key] = _s;
            }          
        });
        logger.info(`Used configuration: \n${yaml.safeDump(config)}`);
    }
}