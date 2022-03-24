import { base, DemoEnvironment } from "./base";

export const environment: DemoEnvironment = {
  ...base,
  production: false,
  testing: true
};
