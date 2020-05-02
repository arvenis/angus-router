import {Config} from '../../src/tools/config';
import _ from 'lodash';
import * as path from 'path';

describe("Config", () => {
    describe ("Default configuration", () => {
        beforeAll(()=> {
            Config.createInstance();
        });

        it("Config object exist", () => {
            expect(Config).toBeDefined();
        });
    
        it("Default settings", () => {
            expect(Config.getConfigItem("config_dir")).toBe("../config");
            expect(Config.getConfigItem("wallet_dir")).toBe("../wallet");
            expect(Config.getConfigItem("components_dir")).toBe("../config");
            expect(Config.getConfigItem("connection_file")).toBe("../config/connection.yaml");
            expect(Config.getConfigItem("inventory_file")).toBe("../config/chaincode.inventory.yaml");
            expect(Config.getConfigItem("openapi_file")).toBe("../config/openapi.yaml");
        });
    })

    describe("Invalid config path", () => {
        beforeAll(()=> {
            Config.createInstance("abc"); 
        });        
    
        it("Use Defaults", () => {

            expect(Config.getConfigItem("config_dir")).toBe("../config");
            expect(Config.getConfigItem("wallet_dir")).toBe("../wallet");
            expect(Config.getConfigItem("components_dir")).toBe("../config");
            expect(Config.getConfigItem("connection_file")).toBe("../config/connection.yaml");
            expect(Config.getConfigItem("inventory_file")).toBe("../config/chaincode.inventory.yaml");
            expect(Config.getConfigItem("openapi_file")).toBe("../config/openapi.yaml");
        });          
    });  
    
    describe("Full configfile", () => {
        beforeAll(()=> {
            Config.createInstance(path.join(__dirname, "config-full.yaml"));
        });        
    
        it("Use from config file", () => {

            expect(Config.getConfigItem("config_dir")).toBe("from_file");
            expect(Config.getConfigItem("wallet_dir")).toBe("from_file");
            expect(Config.getConfigItem("components_dir")).toBe("from_file");
            expect(Config.getConfigItem("connection_file")).toBe("from_file/connection.yaml");
            expect(Config.getConfigItem("inventory_file")).toBe("from_file/chaincode.inventory.yaml");
            expect(Config.getConfigItem("openapi_file")).toBe("from_file/openapi.yaml");
        });    
    
    });
    
    describe("Partly defined configfile", () => {
        beforeAll(()=> {
            Config.createInstance(path.join(__dirname, "config-part.yaml"));
        });        
    
        it("Use from config file (partly)", () => {

            expect(Config.getConfigItem("config_dir")).toBe("from_file");
            expect(Config.getConfigItem("wallet_dir")).toBe("from_file");
            expect(Config.getConfigItem("components_dir")).toBe("from_file");
            expect(Config.getConfigItem("connection_file")).toBe("../config/connection.yaml");
            expect(Config.getConfigItem("inventory_file")).toBe("../config/chaincode.inventory.yaml");
            expect(Config.getConfigItem("openapi_file")).toBe("../config/openapi.yaml");
        });    
    
        

    });

    describe("Use env variables", () => {
        beforeAll(()=> {
            Config.createInstance(path.join(__dirname, "config-part.yaml"));
        });        
    
        it("Use from from env (partly)", () => {

            process.env.OPENAPI_FILE = "from_env";    
            process.env.INVENTORY_FILE = "from_env";

            expect(Config.getConfigItem("config_dir")).toBe("from_file");
            expect(Config.getConfigItem("wallet_dir")).toBe("from_file");
            expect(Config.getConfigItem("components_dir")).toBe("from_file");
            expect(Config.getConfigItem("connection_file")).toBe("../config/connection.yaml");
            expect(Config.getConfigItem("inventory_file")).toBe("from_env");
            expect(Config.getConfigItem("openapi_file")).toBe("from_env");
        });        
    });        
});