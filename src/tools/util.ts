// tslint:disable: no-duplicate-string
import FabricCAServices from 'fabric-ca-client';
import { Gateway, Transaction, Wallet, Wallets, X509Identity } from 'fabric-network';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import _ from 'lodash';
import * as uuid from 'uuid';
import { AngusError, CONST, FabricConfig, FabricError, FabricService, ServiceType } from './common';
import { Config } from './config';
// Get logger
import { getLogger } from './logger';

const logger = getLogger(__filename);

export interface UserToRegister {
  caClient: FabricCAServices;
  wallet: Wallet;
  orgMspId: string;
  adminId: string;
  userId: string;
  userIdSecret?: string;
  affiliation?: string;
}

export interface UserToEnroll {
  caClient: FabricCAServices;
  wallet: Wallet;
  orgMspId: string;
  userId: string;
  userIdSecret: string;
}

export function getConfiguration(): any {
  // TODO: Error handling
  return yaml.load(fs.readFileSync(Config.getConfigItem('connection_file'), 'utf8'));
}

export function getOpenApiAsJson(): any {
  return yaml.load(fs.readFileSync( Config.getConfigItem('openapi_file'), 'utf8'));
}

export async function getWallet(): Promise<Wallet> {
  // TODO: Error handling
  return await Wallets.newFileSystemWallet(Config.getConfigItem('wallet_dir'));
}

export function getAccountId(): string {
  return uuid.v1();
}

export async function isWalletExists(customerId: string): Promise<boolean> {
  try {
    const wallet: Wallet = await getWallet();
    let userExists = !_.isUndefined(await wallet.get(customerId));

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
    const wallet = await getWallet();
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
    const wallet: Wallet = await getWallet();
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
      const _trId: string = _transaction.getTransactionId();

      logger.debug(
        `Transaction ${_fabricConfig.serviceName} has been submitted. trID: ${_trId}`
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

/**
 * Create and register a new CA user in the system
 * @returns secret of the user
 */
export const registerUser = async (userToRegister: UserToRegister): Promise<string> => {
  try {

      // Must use a CA admin (registrar) to register a new user
      const adminIdentity = await userToRegister.wallet.get(userToRegister.adminId);
      if (!adminIdentity) {
          logger.info('An identity for the admin user does not exist in the wallet');
          logger.debug('Enroll the admin user before retrying');
          throw new Error("Admin wallet doesn't exist");
      }

      // build a user object for authenticating with the CA
      const provider = userToRegister.wallet.getProviderRegistry().getProvider(adminIdentity.type);
      const adminUser = await provider.getUserContext(adminIdentity, userToRegister.adminId);

      // Register the user
      // if affiliation is specified by client, the affiliation value must be configured in CA
      const secret = await userToRegister.caClient.register({
          affiliation: userToRegister.affiliation || '.',
          enrollmentID: userToRegister.userId,
          enrollmentSecret: userToRegister.userIdSecret || null,
          role: 'client',
      }, adminUser);
      logger.info(`Successfully registered ${userToRegister.userId}.`);
      return secret;

  } catch (error) {
      logger.error(`Failed to register user : ${error}`);
      throw error;
  }
};

/**
 * Enroll a registered CA user and store the credentials in the wallet
 * @param userToEnroll details about the user and the wallet to use
 */
export async function enrollUserToWallet(userToEnroll: UserToEnroll): Promise<void> {
  try {

      // check that the identity isn't already in the wallet
      const existingIdentity = await userToEnroll.wallet.get(userToEnroll.userId);
      if (existingIdentity) {
          logger.debug(`Identity ${userToEnroll.userId} already exists in the wallet`);
          throw new Error(`Wallet already exist for ${userToEnroll.userId}`);
      }

      // Enroll the user
      const enrollment = await userToEnroll.caClient.enroll({ enrollmentID: userToEnroll.userId, enrollmentSecret: userToEnroll.userIdSecret });

      // store the user
      const identity: X509Identity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes()
        },
        mspId: userToEnroll.orgMspId,
        type: 'X.509',
      };
      await userToEnroll.wallet.put(userToEnroll.userId, identity);
      logger.debug(`Successfully enrolled user ${userToEnroll.userId} and imported it into the wallet`);
  } catch (error) {
      logger.error(`Failed to enroll user ${userToEnroll.userId}: ${error}`);
  }
};

/**
 * Register new user to the system and enroll it ot the actual wallet
 * @param userId Id of the new user
 */
export async function createNewUser(userId: string):Promise<void> {
  logger.debug('Start createNewUser');

  try {
    const adminId = getRegistrarId();
    const caClient = getCertificateAuthority();
    const wallet = await getWallet();
    const orgMspId = getMspId();

    const pw = await registerUser({
      userId,
      adminId,
      caClient,
      wallet,
      orgMspId,
    })
    await enrollUserToWallet({
        userId,
        userIdSecret: pw,
        caClient,
        wallet,
        orgMspId,
    });

    logger.info(`New User successfully registered and added to the wallet ${userId}.`);
    return;
  } catch (error) {
    logger.error(error);
    throw new FabricError(error);
  }
}

export function getCertificateAuthority(): FabricCAServices {
  const ccp = getConfiguration();
  const caName=_.get (ccp, 'caName');
  const caUrl = _.get(ccp, `certificateAuthorities.${caName}.url`);
  const ca = new FabricCAServices(caUrl);
  
  logger.debug(`Got fabric CA services for ${caUrl}`);
  return ca;
}

export function getMspId(): string {
  const ccp = getConfiguration();
  // Default organization - Customer
  const defaultOrg=_.get (ccp, 'client.organization');
  const mspId = _.get(ccp, `organizations.${defaultOrg}.mspid`);
  return mspId;
}

export function getRegistrarId(): string {
  const ccp = getConfiguration();
  const caName=_.get (ccp, 'caName');
  const registrarId = _.get(ccp, `certificateAuthorities.${caName}.registrarId`);
  return registrarId;
}

export function getRegistrarSecret(): string {
  const registrarId = Config.getConfigItem("registrar_secret");   // Env
  return registrarId;
}
