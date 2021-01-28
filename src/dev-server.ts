import { AngusRouter } from './server';
import * as path from 'path';

let _serverConfigFile=process.argv[2]?process.argv[2]:"config/server.yaml";

const router = new AngusRouter(path.join(__dirname, _serverConfigFile));
router.start();