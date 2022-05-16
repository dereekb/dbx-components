import { base, APP_CODE_PREFIXEnvironment } from "./base";

export const environment: APP_CODE_PREFIXEnvironment = {
  ...base,
  production: true,
  firebase: {
    ...base.firebase,
    emulators: {
      useEmulators: false
    }
  }
};
