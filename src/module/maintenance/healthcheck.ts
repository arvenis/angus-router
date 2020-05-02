import * as Express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

import _ from 'lodash';
import { FabricConfig, FabricService } from '../../tools/common';
import * as util from '../../tools/util';
// import {MResHealthcheck} from '../../tools/model/mResHealthcheck'

// Get logger
// import { getLogger } from '../../tools/logger';
// const logger = getLogger(__filename);

export async function customHandler(
  params: FabricService,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
// ):Promise<MResHealthcheck> {
  ):Promise<any> {  
  const pjson = yaml.safeLoad(
    fs.readFileSync(path.join(path.dirname(path.dirname(__dirname)), 'package.json'), 'utf8')
  );

  const result: any[] = [];

  await Promise.all(
    params.fabricServices.map(async (config: FabricConfig) => {
      const _param: FabricService = params;
      _param.fabricServices = [];
      _param.fabricServices.push(config);
      result.push(await util.processTransaction(_param));
    })
  );

  return {
    gateway: {
      status: 'OK',
      version: pjson.version,  
    },
    chaincode: result
  };
}
