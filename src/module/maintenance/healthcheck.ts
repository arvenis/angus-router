import * as Express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import * as path from 'path';
import { FabricConfig, FabricService, FCustomHandler } from '../../tools/common';
import * as util from '../../tools/util';

// import {MResHealthcheck} from '../../tools/model/mResHealthcheck'

// Get logger
// import { getLogger } from '../../tools/logger';
// const logger = getLogger(__filename);

export const healthcheck: FCustomHandler = async (
  params: FabricService,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
  // ):Promise<MResHealthcheck> {
): Promise<any> {
  const pjson = yaml.load(fs.readFileSync(path.join(path.dirname(path.dirname(__dirname)), 'package.json'), 'utf8'));

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
      version: pjson['version'],
    },
    chaincode: result,
  };
}
