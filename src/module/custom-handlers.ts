import { FCustomHandlerMap } from "../tools/common";
import { healthcheck } from "./maintenance/healthcheck";

export const customhandlers: FCustomHandlerMap = {
    'maintenance/healthcheck': healthcheck
  }