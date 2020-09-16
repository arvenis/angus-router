declare module 'angus-router' {

  export enum ServiceType {
    SUBMIT = 'submit',
    EVALUATE = 'evaluate'
  }

  export class FabricConfig {
    public name: string;
    public channelName: string;
    public chaincodeName: string;
    public smartContractName: string;
    public serviceName: string;
    public processType: ServiceType;
    public defaultUser: string;
  }
  
  export class FabricService {
    public customerId: string;
    public serviceParams: string;
    public fabricServices: FabricConfig[];
  }
  
  //@ts-ignore TS2300 
  export class AngusRouter  {
    constructor(configFile?: string);
      start(): void;
  }

  export function processTransaction(params: FabricService, config?: FabricConfig): Promise<any>;

}
