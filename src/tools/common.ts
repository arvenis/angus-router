// tslint:disable: max-classes-per-file
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { getLogger } from './logger';

export enum ServiceType {
  SUBMIT = 'submit',
  EVALUATE = 'evaluate'
}

export enum CONST {
  HEADER_USERID = 'X-angus-Userid',
  CONFIG_TAG='x-angus-config',
  CUSTOM_HANDLER_TAG='x-angus-custom-handler'
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

export type FCustomHandler = (params: FabricService, request: Request, response: Response, next: NextFunction) => any;

export class GenericError extends Error {
  public status: number;
  public code: string;
  public level: string;
  public label: string;
  public timestamp: number;

  constructor(error:any) {
    super(error);
  }
}

export class AngusError extends GenericError {
  constructor(error:any) {
    super(error);
    //const logger = getLogger("AngusError").error(error);

  }  
}

export class FabricError extends GenericError {

  constructor(error:any) {
    super(error);
    const _errPieces:string[]=error.stack.split("|");

    const _errCode:string  = _errPieces[1];
    const _errMsg:string   = _errPieces[2];
    const _errStack:string = _errPieces[3];

    // tslint:disable-next-line:no-console
    console.error("*************************");
    // tslint:disable-next-line:no-console
    console.error(error);
    this.name="FabricError";
    this.status=error.status || 500;
    this.label=error.label;
    this.level=error.level;
    this.code=_errCode || "UNKNOWN_ERROR";
    this.message=_errMsg || "Sorry, we don't really know what happened...";
    this.stack=_errStack;
    this.timestamp=_.now();
  }
}