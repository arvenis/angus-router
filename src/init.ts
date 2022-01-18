import { getLogger } from './tools/logger';
import * as util from './tools/util';

const logger = getLogger(__filename);

export async function initialize() {
    logger.info("Initialize gateway....")
    logger.debug("Checking admin enrollment..")
    
    const _registrarId = util.getRegistrarId();
    let _registrarSecret =  util.getRegistrarSecret();
    let _systemUsers = ["system"]
    const caClient = util.getCertificateAuthority();
    const wallet = await util.getWallet();
    const orgMspId = util.getMspId();

    logger.info ("Checking for admin certificate")

    try {
        if (!(await util.isWalletExists(_registrarId))) {
            logger.info(`Admin wallet for registrar ${_registrarId} doesn't exist, we have to enroll it.`);
            await util.enrollUserToWallet({
                userId: _registrarId,
                userIdSecret: _registrarSecret,
                caClient,
                wallet,
                orgMspId,
            });
          }
    } catch (error) {
        logger.error(error);
        return error;
    }

    logger.info ("Checking for system certificates");        

    try {
        for (let i=0; i<_systemUsers.length; i++) {

            if (!(await util.isWalletExists(_systemUsers[i]))) {
                logger.info(`Wallet for user ${_systemUsers[i]} doesn't exist, we have to create it.`);
                const _pw = await util.registerUser({
                    userId: _systemUsers[i],
                    adminId: _registrarId,
                    caClient,
                    wallet,
                    orgMspId,
                })
                await util.enrollUserToWallet({
                    userId: _systemUsers[i],
                    userIdSecret: _pw,
                    caClient,
                    wallet,
                    orgMspId,
                });
            }
        }
    } catch (error) {
        logger.error(error);
        return error;
    }

    logger.debug("Initialization finished.")
}