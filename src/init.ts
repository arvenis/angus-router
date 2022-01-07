import * as Express from 'express';
import FabricCAServices from 'fabric-ca-client';
import { User } from 'fabric-common';
import { Gateway, Identity, Wallet, X509Identity } from 'fabric-network';
import * as fs from 'fs';
import _, { forEach } from 'lodash';
import * as path from 'path';
import { Config } from './tools/config';
import { getLogger } from './tools/logger';
import * as util from './tools/util';



const logger = getLogger(__filename);

async function createUser(admin: string, username: string): Promise<string> {

    const mspId = util.getMspId();
    const ca = util.getCertificateAuthority();
    const _adminIdentity:Identity = await (await util.getWallet()).get(admin)
    const adminUser: User= User.createUser("admin", "", mspId, _adminIdentity["credentials"]["certificate"], _adminIdentity["credentials"]["privateKey"]);

    // Register the user
    logger.debug(`Creating secret for ${username}...`);
    const _secret = await ca.register({ affiliation: '.', enrollmentID: username, role: 'client' }, adminUser);
    logger.debug(`Secret created for ${username}`);

    return _secret
}

async function enrollUser (username: string, password: string) {

    const mspId = util.getMspId();
    const ca = util.getCertificateAuthority();
    const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: password });
    const userIdentity: X509Identity = {
        type: "X.509",
        mspId: mspId,
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
    
    const _registrarId = util.getRegistrarId();
    let _registrarSecret =  util.getRegistrarSecret();
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