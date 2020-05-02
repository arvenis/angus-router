// tslint:disable: no-duplicate-string
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import * as path from 'path';
import * as uuid from 'uuid';

import { FabricConfig, FabricService, ServiceType, FabricError } from './common';

import { Gateway, Transaction } from 'fabric-network';

import { TransactionId } from 'fabric-client';
import { FileSystemWallet } from 'fabric-network';
import { Config } from './config';


// Get logger
import { getLogger } from './logger';
const logger = getLogger(__filename);

const configDir:string = process.env.FABRIC_GW_CGG_PATH    || path.join(path.dirname(__dirname), "config");
const walletDir:string = process.env.FABRIC_GW_WALLET      || path.join(path.dirname(path.dirname(path.dirname(__dirname))), "wallet");
const connConfig:string = process.env.FABRIC_GW_CONNECTION || path.join(path.dirname(__dirname), "config", "connection.yaml");

export function getConfigDir() {
  return configDir;
}
export function getWalletDir() {
  return walletDir;
}

export function getConnectionFile(): string {
  return connConfig;
}

export function getConfiguration(): any {
  // TODO: Error handling
  return yaml.safeLoad(fs.readFileSync(connConfig, 'utf8'));
}

export function getOpenApiFile(): string {
  return path.join(getConfigDir(), 'openapi.yaml');
}

export function getOpenApiAsJson(): any {
  return yaml.safeLoad(fs.readFileSync(getOpenApiFile(), 'utf8'));
}

export function getWallet(): FileSystemWallet {
  // TODO: Error handling
  return new FileSystemWallet(Config.getConfigItem('wallet_dir'));
}

export function getAccountId(): string {
  return uuid.v1();
}

export async function isWalletExists(customerId: string): Promise<boolean> {
  try {
    const wallet = getWallet();
    let userExists = false;

    userExists = await wallet.exists(customerId);

    if (userExists) {
      logger.debug(`Wallet ${customerId} already exists.`);
    } else {
      logger.debug(`Wallet ${customerId} does not exists.`);
    }
    return userExists;
  } catch (error) {
    logger.error(error);
    return error;
  }
}

export async function getConnectedGateway(customerId: string): Promise<Gateway> {
  try {
    // Read fabric configuration
    const ccp = getConfiguration();
    logger.debug('Configuration loaded');

    // Create a new file system based wallet for managing identities.
    logger.debug('Loading wallet...');
    const wallet = getWallet();
    logger.debug('Wallet loaded.');

    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
    logger.debug(`Connecting to the gateway as ${customerId}...`);
    await gateway.connect(ccp, { wallet, identity: customerId, discovery: { enabled: false } });
    logger.debug(`Connected to the gateway as ${customerId}.`);

    return gateway;
  } catch (error) {
    logger.error(error);
    return error;
  }
}

export async function processTransaction(params: FabricService, config?: FabricConfig): Promise<any> {
  try {
    let _fabricConfig: FabricConfig;
    if (_.isNil(config)) {
      _fabricConfig = params.fabricServices[0];
    } else {
      _fabricConfig = config;
    }

    logger.debug(`Start transaction with service ${_fabricConfig.serviceName}`);

    // Read fabric configuration
    const ccp = getConfiguration();
    logger.debug('Configuration loaded');

    // Create a new file system based wallet for managing identities.
    logger.debug('Loading wallet...');
    const wallet = getWallet();
    logger.debug('Wallet loaded.');

    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
    logger.debug(`Connecting to the gateway as ${params.customerId}...`);
    await gateway.connect(ccp, { wallet, identity: params.customerId, discovery: { enabled: false } });
    logger.debug(`Connected to the gateway as ${params.customerId}.`);

    // Get the network (channel) our contract is deployed to.
    logger.debug(`Loading network channel ${_fabricConfig.channelName}...`);
    const network = await gateway.getNetwork(_fabricConfig.channelName);
    logger.debug(`Network channel ${_fabricConfig.channelName} created.`);

    // Get the contract from the network.
    logger.debug(`Loading contract ${_fabricConfig.chaincodeName} from ${_fabricConfig.smartContractName}...`);
    const contract = network.getContract(_fabricConfig.chaincodeName, _fabricConfig.smartContractName);
    logger.debug(`Contract ${_fabricConfig.chaincodeName} from ${_fabricConfig.smartContractName} loaded.`);

    let retval: any;
    if (_.eq(_fabricConfig.processType, ServiceType.EVALUATE)) {
      // Evaluate the specified transaction.
      logger.debug(`Evaluate transaction ${_fabricConfig.serviceName}...`);
      const result = await contract.evaluateTransaction(_fabricConfig.serviceName, ...[params.serviceParams]);
      retval = JSON.parse(result.toString());
      logger.debug(`Transaction ${_fabricConfig.serviceName} has been evaluated, result is: ${result.toString()}`);
    } else if (_.eq(_fabricConfig.processType, ServiceType.SUBMIT)) {
      // Submit the specified transaction.
      logger.debug(`Creating transaction ${_fabricConfig.serviceName}...`);
      const _transaction: Transaction = contract.createTransaction(_fabricConfig.serviceName);
      const _trId: TransactionId = _transaction.getTransactionID();

      logger.debug(
        `Transaction ${_fabricConfig.serviceName} has been submitted. trID: ${JSON.stringify(_trId.getTransactionID())}`
      );
      await _transaction.submit(...[params.serviceParams]).then(data => {
        logger.debug(`Result: ${JSON.parse(data.toString())}`);
        return (retval = JSON.parse(data.toString()));
      });
    } else {
      throw new Error(`Bad process type: ${_fabricConfig.processType}`);
    }
    return retval;
  } catch (error) {
    throw new FabricError(error);
  }
}