import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { applyEnvVarOverrides, isCliEnvConfigComplete, resolveActiveEnvName } from './env';

describe('resolveActiveEnvName', () => {
  const ENV_VAR = '__TEST_RESOLVE_ACTIVE_ENV_VAR__';

  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it('prefers the CLI flag over env var and default', () => {
    process.env[ENV_VAR] = 'env-var';
    expect(resolveActiveEnvName({ flagEnv: 'flag', envVarName: ENV_VAR, defaultEnv: 'default' })).toBe('flag');
  });

  it('falls back to env var when no flag is set', () => {
    process.env[ENV_VAR] = 'env-var';
    expect(resolveActiveEnvName({ envVarName: ENV_VAR, defaultEnv: 'default' })).toBe('env-var');
  });

  it('falls back to default when neither flag nor env var is set', () => {
    expect(resolveActiveEnvName({ envVarName: ENV_VAR, defaultEnv: 'default' })).toBe('default');
  });
});

describe('applyEnvVarOverrides', () => {
  const KEYS = ['MY_CLI_API_BASE_URL', 'MY_CLI_OIDC_ISSUER', 'MY_CLI_CLIENT_ID', 'MY_CLI_CLIENT_SECRET', 'MY_CLI_REDIRECT_URI', 'MY_CLI_SCOPES'];

  beforeEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
  });

  it('returns undefined when no env config and no overrides', () => {
    expect(applyEnvVarOverrides({ cliName: 'my-cli', env: undefined })).toBeUndefined();
  });

  it('applies env-var overrides on top of stored env', () => {
    process.env['MY_CLI_CLIENT_ID'] = 'override-id';
    const result = applyEnvVarOverrides({
      cliName: 'my-cli',
      env: { apiBaseUrl: 'a', oidcIssuer: 'o', clientId: 'stored', clientSecret: 's', redirectUri: 'r' }
    });
    expect(result?.clientId).toBe('override-id');
    expect(result?.apiBaseUrl).toBe('a');
    expect(result?.clientSecret).toBe('s');
  });
});

describe('isCliEnvConfigComplete', () => {
  it('is true only when all required fields are present', () => {
    expect(isCliEnvConfigComplete({ apiBaseUrl: 'a', oidcIssuer: 'o', clientId: 'i', clientSecret: 's', redirectUri: 'r' })).toBe(true);
    expect(isCliEnvConfigComplete({ apiBaseUrl: 'a', oidcIssuer: 'o', clientId: 'i', clientSecret: 's' })).toBe(false);
    expect(isCliEnvConfigComplete(undefined)).toBe(false);
  });
});
