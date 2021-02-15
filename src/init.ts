import * as Express from 'express';
import _, { forEach } from 'lodash';
import * as path from 'path';
import * as fs from 'fs';

import { Gateway, X509Identity, Wallet } from 'fabric-network';
import { User } from 'fabric-common';
import FabricCAServices  from 'fabric-ca-client';

import * as util from './tools/util';

import { getLogger } from './tools/logger';
import { Config } from './tools/config';
const logger = getLogger(__filename);

async function createUser(admin: string, username: string): Promise<string> {

    const ccp = util.getConfiguration();
    // Default organization - Customer
    const _defaultOrg="c01";     // env


    const _caUrl = _.get(ccp, 'certificateAuthorities.angusCa.url');
    const _mspId = _.get(ccp, `organizations.${_defaultOrg}.mspid`);
    const ca = new FabricCAServices(_caUrl);

    const _adminId = await (await util.getWallet()).get(admin)

    const adminIdentity= User.createUser("admin", "", _mspId, _adminId["credentials"]["certificate"], _adminId["credentials"]["privateKey"]);

    // Register the user
    logger.debug(`Creating secret for ${username}...`);
    const _secret = await ca.register({ affiliation: '.', enrollmentID: username, role: 'client' }, adminIdentity);
    logger.debug(`Secret created for ${username}`);

    return _secret
}

async function enrollUser (username: string, password: string) {

    const ccp = util.getConfiguration();
    // Default organization - Customer
    const _defaultOrg="c01";     // env

    const _caUrl = _.get(ccp, 'certificateAuthorities.angusCa.url');
    const _mspId = _.get(ccp, `organizations.${_defaultOrg}.mspid`);
    const ca = new FabricCAServices(_caUrl);

    logger.debug(`Got fabric CA services for ${_caUrl}`);
    const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: password });

    const userIdentity: X509Identity = {
        type: "X.509",
        mspId: _mspId,
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes()
        }
    }

    logger.debug(`User identity created for ${username}`);
    await (await util.getWallet()).put(username, userIdentity)

}

export async function initialize() {
    logger.info("Initialize gateway....")
    logger.debug("Checking admin enrollment..")
    let _registrarId = "admin"  // Env
    let _registrarSecret = "adminpw"    // Env
    let _systemUsers = ["system"]

    logger.info ("Checking for admin certificate")

    try {
        if (!(await util.isWalletExists(_registrarId))) {
            logger.info(`Admin wallet for registrar ${_registrarId} doesn't exist, we have to enroll it.`);
            await enrollUser(_registrarId, _registrarSecret);
          }
    } catch (error) {
        logger.error(error);
        return error;
    }

    logger.info ("Checking for system certificates");        
    
    try {
        for (let i=0; i<_systemUsers.length; i++) {
            
            if (!(await util.isWalletExists(_systemUsers[i]))) {
                logger.info(`Wallet for user ${_systemUsers[i]} doesn't exist, yo have to create it.`);
                const _pw = await createUser(_registrarId, _systemUsers[i])

                await enrollUser(_systemUsers[i], _pw);
            }
        }
    } catch (error) {
        logger.error(error);
        return error;
    }

    logger.debug("Initialization finished.")
}