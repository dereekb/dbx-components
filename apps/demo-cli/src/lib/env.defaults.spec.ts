import { describe, expect, it } from 'vitest';
import { EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE, MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE } from 'demo-firebase';
import { DEFAULT_DEMO_CLI_ENVS, DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV } from './env.defaults';

function scopesForEnv(name: string): string[] {
  const envDefault = DEFAULT_DEMO_CLI_ENVS.find((x) => x.names.includes(name));
  return (envDefault?.env.scopes ?? '').split(' ');
}

describe('DEFAULT_DEMO_CLI_ENVS', () => {
  it('should give every env name to exactly one env', () => {
    const names = DEFAULT_DEMO_CLI_ENVS.flatMap((x) => x.names);
    expect(new Set(names).size).toBe(names.length);
  });

  describe('microsoft mint envs', () => {
    // a microsoft mint is refused (403 SCOPE_FORBIDDEN) unless the grant holds token.external AND one of the scope ceilings
    it('should not give the plain external-token env a microsoft ceiling', () => {
      const scopes = scopesForEnv('external-token');
      expect(scopes).toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
      expect(scopes).not.toContain(MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE);
      expect(scopes).not.toContain(MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE);
    });

    it.each(['msgraph-read', 'dev-msgraph-read', 'prod-msgraph-read'])('should give %s token.external and only the Read ceiling', (name) => {
      const scopes = scopesForEnv(name);
      expect(scopes).toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
      expect(scopes).toContain(MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE);
      expect(scopes).not.toContain(MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE);
    });

    it.each(['msgraph-admin', 'dev-msgraph-admin', 'prod-msgraph-admin'])('should give %s token.external and the Read + Write ceiling', (name) => {
      const scopes = scopesForEnv(name);
      expect(scopes).toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
      expect(scopes).toContain(MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE);
    });

    it('should point the local msgraph envs at the same server as the local external-token env', () => {
      const local = DEFAULT_DEMO_CLI_ENVS.find((x) => x.names.includes('msgraph-read'));
      expect(local?.env.apiBaseUrl).toBe(DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV.env.apiBaseUrl);
      expect(local?.env.oidcIssuer).toBe(DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV.env.oidcIssuer);
    });
  });
});
