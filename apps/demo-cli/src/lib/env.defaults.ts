import type { CliEnvDefault } from '@dereekb/dbx-cli';

const DEMO_LOCAL_API_BASE_URL = 'http://localhost:9902/dereekb-components/us-central1/api';
const DEMO_PROD_API_BASE_URL = 'https://components.dereekb.com/api';

const DEMO_LOCAL_OIDC_ISSUER = `${DEMO_LOCAL_API_BASE_URL}/oidc`;
const DEMO_PROD_OIDC_ISSUER = `${DEMO_PROD_API_BASE_URL}/oidc`;

const DEMO_DEFAULT_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

export const DEMO_LOCAL_ENV_DEFAULT: CliEnvDefault = {
  names: ['local', 'dev'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    redirectUri: DEMO_DEFAULT_REDIRECT_URI
  }
};

export const DEMO_PROD_ENV_DEFAULT: CliEnvDefault = {
  names: ['prod', 'production'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    redirectUri: DEMO_DEFAULT_REDIRECT_URI
  }
};

export const DEMO_CLI_DEFAULT_ENVS: readonly CliEnvDefault[] = [DEMO_LOCAL_ENV_DEFAULT, DEMO_PROD_ENV_DEFAULT];
