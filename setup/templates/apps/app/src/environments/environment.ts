import { base, APP_CODE_PREFIXEnvironment } from "./base";

export const environment: APP_CODE_PREFIXEnvironment = {
  ...base,
  production: false,
  testing: true,
  firebase: {
    ...base.firebase,
    enabledLoginMethods: true // enables all login methods by default
  }
};
