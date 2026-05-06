import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { applyEnvVarOverrides, findCliEnvDefault, isCliEnvConfigComplete, mergeCliEnvWithDefault, resolveActiveEnvName, type CliEnvDefault } from './env';

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
  const KEYS = ['MY_CLI_API_BASE_URL', 'MY_CLI_OIDC_ISSUER', 'MY_CLI_APP_CLIENT_URL', 'MY_CLI_CLIENT_ID', 'MY_CLI_CLIENT_SECRET', 'MY_CLI_REDIRECT_URI', 'MY_CLI_SCOPES'];

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

  it('applies APP_CLIENT_URL override', () => {
    process.env['MY_CLI_APP_CLIENT_URL'] = 'http://override-client';
    const result = applyEnvVarOverrides({
      cliName: 'my-cli',
      env: { apiBaseUrl: 'a', oidcIssuer: 'o', appClientUrl: 'http://stored-client', clientId: 'i', clientSecret: 's', redirectUri: 'r' }
    });
    expect(result?.appClientUrl).toBe('http://override-client');
  });
});

describe('isCliEnvConfigComplete', () => {
  it('is true only when all required fields are present', () => {
    expect(isCliEnvConfigComplete({ apiBaseUrl: 'a', oidcIssuer: 'o', clientId: 'i', clientSecret: 's', redirectUri: 'r' })).toBe(true);
    expect(isCliEnvConfigComplete({ apiBaseUrl: 'a', oidcIssuer: 'o', clientId: 'i', clientSecret: 's' })).toBe(false);
    expect(isCliEnvConfigComplete(undefined)).toBe(false);
  });
});

describe('findCliEnvDefault', () => {
  const defaults: CliEnvDefault[] = [
    { names: ['local', 'dev'], env: { apiBaseUrl: 'http://local' } },
    { names: ['prod', 'production'], env: { apiBaseUrl: 'https://prod' } }
  ];

  it('matches by primary name', () => {
    expect(findCliEnvDefault({ name: 'local', defaults })?.env.apiBaseUrl).toBe('http://local');
  });

  it('matches by alias', () => {
    expect(findCliEnvDefault({ name: 'dev', defaults })?.env.apiBaseUrl).toBe('http://local');
    expect(findCliEnvDefault({ name: 'production', defaults })?.env.apiBaseUrl).toBe('https://prod');
  });

  it('returns undefined for unknown names', () => {
    expect(findCliEnvDefault({ name: 'staging', defaults })).toBeUndefined();
  });

  it('returns undefined when no defaults are registered', () => {
    expect(findCliEnvDefault({ name: 'local' })).toBeUndefined();
  });
});

describe('mergeCliEnvWithDefault', () => {
  const defaultEnv = {
    apiBaseUrl: 'http://default',
    oidcIssuer: 'http://default/oidc',
    redirectUri: 'urn:default'
  } as const;

  it('returns undefined when both sides are empty', () => {
    expect(mergeCliEnvWithDefault({})).toBeUndefined();
  });

  it('returns the default when no stored env is provided', () => {
    expect(mergeCliEnvWithDefault({ defaultEnv })).toEqual({
      apiBaseUrl: 'http://default',
      oidcIssuer: 'http://default/oidc',
      appClientUrl: undefined,
      clientId: undefined,
      clientSecret: undefined,
      redirectUri: 'urn:default',
      scopes: undefined
    });
  });

  it('merges appClientUrl from default and stored env', () => {
    const merged = mergeCliEnvWithDefault({
      defaultEnv: { ...defaultEnv, appClientUrl: 'http://default-client' },
      env: { apiBaseUrl: 'http://user', oidcIssuer: 'http://user/oidc' }
    });
    expect(merged?.appClientUrl).toBe('http://default-client');

    const overridden = mergeCliEnvWithDefault({
      defaultEnv: { ...defaultEnv, appClientUrl: 'http://default-client' },
      env: { apiBaseUrl: 'http://user', oidcIssuer: 'http://user/oidc', appClientUrl: 'http://user-client' }
    });
    expect(overridden?.appClientUrl).toBe('http://user-client');
  });

  it('user-set fields shadow defaults', () => {
    const merged = mergeCliEnvWithDefault({
      defaultEnv,
      env: { apiBaseUrl: 'http://user', oidcIssuer: '', redirectUri: 'urn:user' }
    });
    expect(merged?.apiBaseUrl).toBe('http://user');
    expect(merged?.redirectUri).toBe('urn:user');
    expect(merged?.oidcIssuer).toBe('http://default/oidc');
  });

  it('treats empty strings on the stored env as missing', () => {
    const merged = mergeCliEnvWithDefault({
      defaultEnv,
      env: { apiBaseUrl: '', oidcIssuer: '' }
    });
    expect(merged?.apiBaseUrl).toBe('http://default');
    expect(merged?.oidcIssuer).toBe('http://default/oidc');
    expect(merged?.redirectUri).toBe('urn:default');
  });

  it('preserves stored client credentials over default', () => {
    const merged = mergeCliEnvWithDefault({
      defaultEnv: { ...defaultEnv, clientId: 'def-id', clientSecret: 'def-secret' },
      env: { apiBaseUrl: 'http://user', oidcIssuer: 'http://user/oidc', clientId: 'user-id' }
    });
    expect(merged?.clientId).toBe('user-id');
    expect(merged?.clientSecret).toBe('def-secret');
  });
});
