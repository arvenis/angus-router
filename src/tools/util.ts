// tslint:disable: no-duplicate-string
import { TransactionId } from 'fabric-client';
import { FileSystemWallet, Gateway, Identity, Transaction, X509WalletMixin } from 'fabric-network';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import * as uuid from 'uuid';
import { AngusError, CONST, FabricConfig, FabricError, FabricService, ServiceType } from './common';
import { Config } from './config';
// Get logger
import { getLogger } from './logger';

const logger = getLogger(__filename);

export function getConfiguration(): any {
  // TODO: Error handling
  return yaml.safeLoad(fs.readFileSync(Config.getConfigItem('connection_file'), 'utf8'));
}

export function getOpenApiAsJson(): any {
  return yaml.safeLoad(fs.readFileSync( Config.getConfigItem('openapi_file'), 'utf8'));
}

// Update the 2.x way like it is in the int-gateway repo
/**
export async function getWallet(): Promise<Wallet> {
  // TODO: Error handling
  return await Wallets.newFileSystemWallet(Config.getConfigItem('wallet_dir'));
}
 */

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
    let _customerId=params.customerId;
    // Set default user if it exists
    if (_.isUndefined(_customerId)) 
      _customerId = _fabricConfig.defaultUser;

    if (_.isUndefined(_customerId)) 
      throw new AngusError(`${CONST.HEADER_USERID} is not defined in HTTP header. `);

    logger.debug(`Connecting to the gateway as ${_customerId}...`);
    await gateway.connect(ccp, { wallet, identity: _customerId, discovery: { enabled: false } });
    logger.debug(`Connected to the gateway as ${_customerId}.`);

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

// From integration-gateway - called by the initialization from the router.ts
// async function enrollUser (username: string, password: string) {

//   const ccp = util.getConfiguration();

//   const _defaultOrg=Config.getConfigItem("organization");

//   const _caUrl = _.get(ccp, 'certificateAuthorities.angusCa.url');
//   const _mspId = _.get(ccp, `organizations.${_defaultOrg}.mspid`);
//   const ca = new FabricCAServices(_caUrl);

//   logger.debug(`Got fabric CA services for ${_caUrl}`);
//   const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: password });

//   const userIdentity: X509Identity = {
//       type: "X.509",
//       mspId: _mspId,
//       credentials: {
//           certificate: enrollment.certificate,
//           privateKey: enrollment.key.toBytes()
//       }
//   }

//   logger.debug(`User identity created for ${username}`);
//   await (await getWallet()).put(username, userIdentity)
// }

// From fabric-gateway - called by the create-account custom handler
export async function enrollUser(customerId: string, role: string = 'client') {
  logger.debug('Start enrollUser');

  try {
    // Read fabric configuration
    const ccp = getConfiguration();
    logger.debug('Configuration loaded');

    const _adminId = ccp.certificateAuthorities[ccp.caName].registrarId;

    // Check to see if we've already enrolled the user.
    if (await isWalletExists(customerId)) {
      throw new Error(`Wallet already exist for ${customerId}`);
    }

    // Check to see if we've already enrolled the admin user.
    if (!(await isWalletExists(_adminId))) {
      throw new Error("Admin wallet doesn't exist");
    }

    // Create a new file system based wallet for managing identities.
    logger.debug('Loading wallet...');
    const wallet = getWallet();
    logger.debug('Wallet loaded');

    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
    logger.debug(`Connecting to the gateway as ${_adminId}...`);
    await gateway.connect(ccp, { wallet, identity: _adminId, discovery: { enabled: false } });
    logger.debug(`Connected to the gateway as ${_adminId}.`);

    // Get the CA client object from the gateway for interacting with the CA.
    logger.debug('Get CA ...');
    const ca = gateway.getClient().getCertificateAuthority();
    logger.debug('Get admin identity...');
    const adminIdentity = gateway.getCurrentIdentity();
    logger.debug('Got identities.');

    // Register the user, enroll the user, and import the new identity into the wallet.
    logger.debug(`Creating secret for ${customerId}...`);
    const secret = await ca.register({ affiliation: '.', enrollmentID: customerId, role }, adminIdentity);
    logger.debug(`Secret created for ${customerId}`);
    const enrollment = await ca.enroll({ enrollmentID: customerId, enrollmentSecret: secret });
    logger.debug(`Enrollment created for ${customerId}`);
    const userIdentity: Identity = X509WalletMixin.createIdentity(
      ccp.mspName,
      enrollment.certificate,
      enrollment.key.toBytes()
    );
    logger.debug(`User identity created for ${customerId}`);
    await wallet.import(customerId, userIdentity);
    logger.info(`Successfully registered and enrolled user ${customerId} and imported it into the wallet`);
    return userIdentity.type;
  } catch (error) {
    logger.error(error);
    throw new FabricError(error);
    // return error;
  }
}