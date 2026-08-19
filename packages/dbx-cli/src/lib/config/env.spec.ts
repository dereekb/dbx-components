import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { applyEnvVarOverrides, cliFirebaseEmulatorsInUse, DEFAULT_CLI_OIDC_SCOPES, filterReadOnlyModelScopes, findCliEnvDefault, isCliEnvConfigComplete, isCliFirebaseConfigComplete, mergeCliEnvWithDefault, readEnvTokenEntry, resolveActiveEnvName, withServiceTokenScopes, type CliEnvDefault } from './env';

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

describe('filterReadOnlyModelScopes', () => {
  it('removes model.create / model.update / model.delete and preserves the rest', () => {
    expect(filterReadOnlyModelScopes('openid profile email demo model.create model.read model.update model.delete model.query')).toBe('openid profile email demo model.read model.query');
  });

  it('returns the default scopes filtered when input is undefined', () => {
    expect(filterReadOnlyModelScopes(undefined)).toBe(DEFAULT_CLI_OIDC_SCOPES);
  });

  it('collapses internal whitespace', () => {
    expect(filterReadOnlyModelScopes('openid   model.create  model.read')).toBe('openid model.read');
  });

  it('keeps model.read and model.query when those are the only model scopes', () => {
    expect(filterReadOnlyModelScopes('openid model.read model.query')).toBe('openid model.read model.query');
  });

  it('returns an empty string when every scope is a write scope', () => {
    expect(filterReadOnlyModelScopes('model.create model.update model.delete')).toBe('');
  });
});

describe('withServiceTokenScopes', () => {
  it('adds token.service and offline_access to the requested scopes', () => {
    const result = withServiceTokenScopes('openid profile email demo').split(' ');
    expect(result).toContain('token.service');
    expect(result).toContain('offline_access');
    expect(result).toContain('demo');
  });

  it('does not duplicate scopes already present', () => {
    const result = withServiceTokenScopes('openid demo offline_access token.service').split(' ');
    expect(result.filter((s) => s === 'token.service')).toHaveLength(1);
    expect(result.filter((s) => s === 'offline_access')).toHaveLength(1);
  });

  it('augments the default scopes when input is undefined', () => {
    const result = withServiceTokenScopes(undefined).split(' ');
    expect(result).toContain('token.service');
    expect(result).toContain('offline_access');
    expect(result).toContain('openid');
  });

  it('composes with filterReadOnlyModelScopes (read-only service token)', () => {
    const result = withServiceTokenScopes(filterReadOnlyModelScopes('openid demo model.create model.read model.update model.delete model.query')).split(' ');
    expect(result).toContain('token.service');
    expect(result).toContain('model.read');
    expect(result).not.toContain('model.create');
    expect(result).not.toContain('model.delete');
  });
});

describe('readEnvTokenEntry', () => {
  const KEYS = ['MY_CLI_REFRESH_TOKEN', 'MY_CLI_ACCESS_TOKEN', 'MY_CLI_TOKEN_SCOPE'];

  beforeEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
  });

  it('returns undefined when no refresh token is set', () => {
    expect(readEnvTokenEntry({ cliName: 'my-cli' })).toBeUndefined();
  });

  it('returns a refresh-only entry forced to refresh on first use', () => {
    process.env['MY_CLI_REFRESH_TOKEN'] = 'rt-123';
    const entry = readEnvTokenEntry({ cliName: 'my-cli' });
    expect(entry?.refreshToken).toBe('rt-123');
    expect(entry?.accessToken).toBe('');
    expect(entry?.expiresAt).toBe(0);
    expect(entry?.fromEnv).toBe(true);
  });

  it('reads the optional access token and token scope', () => {
    process.env['MY_CLI_REFRESH_TOKEN'] = 'rt-123';
    process.env['MY_CLI_ACCESS_TOKEN'] = 'at-456';
    process.env['MY_CLI_TOKEN_SCOPE'] = 'openid demo token.service';
    const entry = readEnvTokenEntry({ cliName: 'my-cli' });
    expect(entry?.refreshToken).toBe('rt-123');
    expect(entry?.accessToken).toBe('at-456');
    expect(entry?.scope).toBe('openid demo token.service');
    expect(entry?.fromEnv).toBe(true);
    // Still forces a refresh first since no reliable expiry is supplied via env.
    expect(entry?.expiresAt).toBe(0);
  });

  it('derives the env-var prefix from the cli name (dashes → underscores, upper-cased)', () => {
    process.env['MY_CLI_REFRESH_TOKEN'] = 'rt-xyz';
    expect(readEnvTokenEntry({ cliName: 'my-cli' })?.refreshToken).toBe('rt-xyz');
  });
});

describe('firebase client config', () => {
  const FIREBASE_KEYS = ['MY_CLI_FIREBASE_API_KEY', 'MY_CLI_FIREBASE_AUTH_DOMAIN', 'MY_CLI_FIREBASE_PROJECT_ID', 'MY_CLI_FIREBASE_APP_ID', 'MY_CLI_FIREBASE_EMULATOR_HOST', 'MY_CLI_FIREBASE_AUTH_EMULATOR_PORT', 'MY_CLI_FIREBASE_FIRESTORE_EMULATOR_PORT'];

  beforeEach(() => {
    FIREBASE_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    FIREBASE_KEYS.forEach((k) => delete process.env[k]);
  });

  describe('isCliFirebaseConfigComplete()', () => {
    it('requires apiKey, projectId, and appId', () => {
      expect(isCliFirebaseConfigComplete(undefined)).toBe(false);
      expect(isCliFirebaseConfigComplete({ apiKey: 'k', projectId: 'p' })).toBe(false);
      expect(isCliFirebaseConfigComplete({ apiKey: 'k', projectId: 'p', appId: 'a' })).toBe(true);
    });
  });

  describe('isCliEnvConfigComplete()', () => {
    it('does not require the firebase config (existing CLIs must keep working)', () => {
      expect(isCliEnvConfigComplete({ apiBaseUrl: 'u', oidcIssuer: 'i', clientId: 'c', clientSecret: 's', redirectUri: 'r' })).toBe(true);
    });
  });

  describe('cliFirebaseEmulatorsInUse()', () => {
    it('is false without emulator config', () => {
      expect(cliFirebaseEmulatorsInUse({ apiKey: 'k', projectId: 'p', appId: 'a' })).toBe(false);
    });

    it('is true when a port is configured and not explicitly disabled', () => {
      expect(cliFirebaseEmulatorsInUse({ emulators: { firestorePort: 9904 } })).toBe(true);
    });

    it('is false when explicitly disabled', () => {
      expect(cliFirebaseEmulatorsInUse({ emulators: { useEmulators: false, firestorePort: 9904 } })).toBe(false);
    });
  });

  describe('mergeCliEnvWithDefault()', () => {
    it('merges the firebase config field by field', () => {
      const merged = mergeCliEnvWithDefault({
        env: { apiBaseUrl: '', oidcIssuer: '', firebase: { projectId: 'stored-project' } },
        defaultEnv: { apiBaseUrl: 'u', oidcIssuer: 'i', firebase: { apiKey: 'default-key', projectId: 'default-project', appId: 'default-app' } }
      });

      expect(merged?.firebase?.apiKey).toBe('default-key');
      expect(merged?.firebase?.projectId).toBe('stored-project');
      expect(merged?.firebase?.appId).toBe('default-app');
    });

    it('leaves firebase undefined when neither side supplies one', () => {
      const merged = mergeCliEnvWithDefault({ env: { apiBaseUrl: 'u', oidcIssuer: 'i' } });
      expect(merged?.firebase).toBeUndefined();
    });
  });

  describe('applyEnvVarOverrides()', () => {
    it('reads the <PREFIX>_FIREBASE_* overrides', () => {
      process.env['MY_CLI_FIREBASE_API_KEY'] = 'env-key';
      process.env['MY_CLI_FIREBASE_PROJECT_ID'] = 'env-project';
      process.env['MY_CLI_FIREBASE_APP_ID'] = 'env-app';
      process.env['MY_CLI_FIREBASE_FIRESTORE_EMULATOR_PORT'] = '9904';

      const env = applyEnvVarOverrides({ cliName: 'my-cli', env: { apiBaseUrl: 'u', oidcIssuer: 'i' } });

      expect(env?.firebase?.apiKey).toBe('env-key');
      expect(env?.firebase?.projectId).toBe('env-project');
      expect(env?.firebase?.appId).toBe('env-app');
      expect(env?.firebase?.emulators?.firestorePort).toBe(9904);
      expect(cliFirebaseEmulatorsInUse(env?.firebase)).toBe(true);
    });

    it('shadows the stored firebase config but keeps unset fields', () => {
      process.env['MY_CLI_FIREBASE_PROJECT_ID'] = 'env-project';

      const env = applyEnvVarOverrides({ cliName: 'my-cli', env: { apiBaseUrl: 'u', oidcIssuer: 'i', firebase: { apiKey: 'stored-key', projectId: 'stored-project', appId: 'stored-app' } } });

      expect(env?.firebase?.projectId).toBe('env-project');
      expect(env?.firebase?.apiKey).toBe('stored-key');
      expect(env?.firebase?.appId).toBe('stored-app');
    });

    it('leaves firebase undefined when neither stored config nor overrides supply one', () => {
      const env = applyEnvVarOverrides({ cliName: 'my-cli', env: { apiBaseUrl: 'u', oidcIssuer: 'i' } });
      expect(env?.firebase).toBeUndefined();
    });
  });
});
