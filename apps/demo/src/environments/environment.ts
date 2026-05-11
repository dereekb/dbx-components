import { base, type DemoEnvironment } from './base';

export const environment: DemoEnvironment = {
  ...base,
  production: false,
  testing: true,
  firebase: {
    ...base.firebase,
    enabledLoginMethods: true
  }
};

/**
 * Optional API origin used by the dbx-firebase OIDC provider when the OIDC issuer is hosted on
 * a different origin than the frontend. Local development is single-origin, so leave undefined.
 */
export const oidcApiOrigin: string | undefined = undefined;
