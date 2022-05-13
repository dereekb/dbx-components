import { base, DemoEnvironment } from "./base";

export const environment: DemoEnvironment = {
  ...base,
  production: true,
  firebase: {
    ...base.firebase,
    emulators: {
      useEmulators: false
    }
  }
};
