import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import { FabricConfig } from './common';
import {Config} from './config';

import { getLogger } from './logger';
const logger = getLogger(__filename);

// tslint:disable-next-line no-namespace
export namespace ChaincodeInventory {
  let _inventory: FabricConfig[];

  export function createInstance() {

    try {
      logger.debug('Creating chaincode inventory...');
      const _inv = yaml.load(fs.readFileSync(Config.getConfigItem("inventory_file"), 'utf8'));
      _inventory = _inv["ccMethods"];
  
      Object.values(_inv["ccMethods"]).forEach((_item: any) => {
        const _invItem: FabricConfig = _item;
        // This transformation is needed because of YAML label substitution
        _invItem.channelName = _item.channelName.name;
        _inventory.push(_invItem);
      });
      logger.debug('Chaincode inventory created.');
  
    } catch (error) {
      logger.error(error);
    }
  }

  export function getInventory(): FabricConfig[] {
    return _inventory;
  }

  export function getInventoryItems(items: string[]): FabricConfig[] {
    const retval: FabricConfig[] = [];
    _.forEach(items, (i: string) => {
      const _item: FabricConfig = _.find(_inventory, (invItem: FabricConfig) => _.eq(invItem.name, i));
      if (_.isUndefined(_item)) {
        logger.warn(`Fabric config ${i} not found`);
      } else {
        retval.push(_item);
      }
    });
    return retval;
  }
}
