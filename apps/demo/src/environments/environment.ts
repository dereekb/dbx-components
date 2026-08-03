import { base, type DemoEnvironment } from './base';

/**
 * Local-development environment configuration.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const environment: DemoEnvironment = {
  ...base,
  production: false,
  testing: true,
  firebase: {
    ...base.firebase,
    enabledLoginMethods: true
  }
};
