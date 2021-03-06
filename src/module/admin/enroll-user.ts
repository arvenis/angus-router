import * as Express from 'express';
import _ from 'lodash';

import { Gateway, Identity, X509WalletMixin } from 'fabric-network';
import FabricCAServices from 'fabric-ca-client';

import { FabricService, AngusError } from '../../tools/common';
import * as util from '../../tools/util';

// Get logger
import { getLogger } from '../../tools/logger';
import { POINT_CONVERSION_UNCOMPRESSED } from 'constants';
const logger = getLogger(__filename);

export async function customHandler(
  params: FabricService,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
// ):Promise<MResHealthcheck> {
  ):Promise<any> {
  
  let _userId=req.body['username'];
  let _password=req.body['password'];
  let _registrarId=req.body['registrar'];

  let _userCreation: boolean = _.isUndefined(_password);

  // Read fabric configuration
  const ccp = util.getConfiguration();
  logger.debug('Configuration loaded');

  let _defaultOrg=_.get (ccp, 'client.organization');

  // Check to see if we've already enrolled the user.
  if (await util.isWalletExists(_userId)) {
    throw new AngusError(`Wallet already exist for ${_userId}`);
  }

  // Check to see if we've already enrolled the admin user, if it is a user creation process
  if (_userCreation) {
    if (!(await util.isWalletExists(_registrarId))) {
      throw new AngusError(`Admin wallet for registrar ${_registrarId} doesn't exist, yo have to enroll it.`);
    }
  }

  // Create a new file system based wallet for managing identities.
  logger.debug('Loading wallet...');
  const wallet = util.getWallet();
  logger.debug('Wallet loaded');

  // Create a new CA client for interacting with the CA.
  logger.debug(`Get fabric CA services for ${ccp.caName}...`);
  const caURL = _.get(ccp, 'certificateAuthorities.angusCa.url');
  const ca = new FabricCAServices(caURL);
  logger.debug(`Got fabric CA services for ${ccp.caName}. url: ${caURL}`);

  if (_userCreation) {
    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
    logger.debug(`Connecting to the gateway as ${_registrarId}...`);
    await gateway.connect(ccp, { wallet, identity: _registrarId, discovery: { enabled: false } });
    logger.debug(`Connected to the gateway as ${_registrarId}.`);

    // This is a user creation process, we have to create the user before enroll it.
    logger.debug('Get admin identity...');
    const adminIdentity = gateway.getCurrentIdentity();
    logger.debug('Got it.');

    // Register the user
    logger.debug(`Creating secret for ${_userId}...`);
    _password = await ca.register({ affiliation: '.', enrollmentID: _userId, role: 'client' }, adminIdentity);
    logger.debug(`Secret created for ${_userId}`);
  
  }

  // enroll the user, and import the new identity into the wallet.
  const _mspId=_.get(ccp, `organizations.${_defaultOrg}.mspid`);
  const enrollment = await ca.enroll({ enrollmentID: _userId, enrollmentSecret: _password });
  logger.debug(`Enrollment created for ${_userId} in ${_mspId}`);
  const userIdentity: Identity = X509WalletMixin.createIdentity(
    _mspId,
    enrollment.certificate,
    enrollment.key.toBytes()
  );
  logger.debug(`User identity created for ${_userId}`);
  await wallet.import(_userId, userIdentity);  
  
  return {
    username: _userId,
    type: userIdentity.type,
    mspId: _mspId
  }
}