import type { CliEnvDefault } from '@dereekb/dbx-cli';

const DEMO_LOCAL_APP_CLIENT_URL = 'http://localhost:9010';
const DEMO_PROD_APP_CLIENT_URL = 'https://components.dereekb.com';

const DEMO_LOCAL_API_BASE_URL = `${DEMO_LOCAL_APP_CLIENT_URL}/api`;
const DEMO_PROD_API_BASE_URL = `${DEMO_PROD_APP_CLIENT_URL}/api`;

const DEMO_LOCAL_OIDC_ISSUER = `${DEMO_LOCAL_APP_CLIENT_URL}/oidc`;
const DEMO_PROD_OIDC_ISSUER = `${DEMO_PROD_APP_CLIENT_URL}/oidc`;

/**
 * Default OIDC scopes the demo-cli requests on `auth login` — every scope the demo OAuth
 * server exposes (identity + full callModel CRUD). Trim with `auth login --read-only-scopes`
 * to drop `model.create`, `model.update`, and `model.delete`.
 *
 * Keep in sync with `DEMO_OIDC_AVAILABLE_SCOPES` in `@dereekb/demo-firebase`.
 */
export const DEMO_CLI_DEFAULT_SCOPES = 'openid profile email demo model.create model.read model.update model.delete model.query';

export const DEMO_LOCAL_ENV_DEFAULT: CliEnvDefault = {
  names: ['local', 'dev'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    appClientUrl: DEMO_LOCAL_APP_CLIENT_URL,
    scopes: DEMO_CLI_DEFAULT_SCOPES
  }
};

export const DEMO_PROD_ENV_DEFAULT: CliEnvDefault = {
  names: ['prod', 'production'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    appClientUrl: DEMO_PROD_APP_CLIENT_URL,
    scopes: DEMO_CLI_DEFAULT_SCOPES
  }
};

export const DEMO_CLI_DEFAULT_ENVS: readonly CliEnvDefault[] = [DEMO_LOCAL_ENV_DEFAULT, DEMO_PROD_ENV_DEFAULT];
