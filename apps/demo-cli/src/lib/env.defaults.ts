import type { CliEnvDefault } from '@dereekb/dbx-cli';

const DEMO_LOCAL_APP_CLIENT_URL = 'http://localhost:9010';
const DEMO_PROD_APP_CLIENT_URL = 'https://components.dereekb.com';

const DEMO_LOCAL_API_BASE_URL = `${DEMO_LOCAL_APP_CLIENT_URL}/api`;
const DEMO_PROD_API_BASE_URL = `${DEMO_PROD_APP_CLIENT_URL}/api`;

const DEMO_LOCAL_OIDC_ISSUER = `${DEMO_LOCAL_APP_CLIENT_URL}/oidc`;
const DEMO_PROD_OIDC_ISSUER = `${DEMO_PROD_APP_CLIENT_URL}/oidc`;

const DEMO_DEFAULT_REDIRECT_URI = 'http://127.0.0.1:0/callback';

export const DEMO_LOCAL_ENV_DEFAULT: CliEnvDefault = {
  names: ['local', 'dev'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    appClientUrl: DEMO_LOCAL_APP_CLIENT_URL,
    redirectUri: DEMO_DEFAULT_REDIRECT_URI
  }
};

export const DEMO_PROD_ENV_DEFAULT: CliEnvDefault = {
  names: ['prod', 'production'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    appClientUrl: DEMO_PROD_APP_CLIENT_URL,
    redirectUri: DEMO_DEFAULT_REDIRECT_URI
  }
};

export const DEMO_CLI_DEFAULT_ENVS: readonly CliEnvDefault[] = [DEMO_LOCAL_ENV_DEFAULT, DEMO_PROD_ENV_DEFAULT];
