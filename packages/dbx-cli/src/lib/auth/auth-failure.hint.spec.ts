import { afterEach, describe, expect, it } from 'vitest';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase';
import { createCliContext, setCliContext } from '../context/cli.context';
import { CliError, CliHttpError } from '../util/output';
import { cliAuthFailureErrorMapper, describeCliAuthFailureSuggestion, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from './auth-failure.hint';

const BASE = { cliName: 'demo-cli', envName: 'dev-mcp', scope: 'openid demo model.read' };
const HANDOFF = { handoff: true, refreshable: false };
const LOGIN = { handoff: false, refreshable: true };

describe('describeCliAuthFailureSuggestion()', () => {
  it('suggests re-minting for a rejected handoff credential', () => {
    const result = describeCliAuthFailureSuggestion({ ...BASE, status: 401, credential: HANDOFF });

    expect(result).toContain('cannot be refreshed');
    expect(result).toContain('demo-cli auth handoff <code> --env dev-mcp');
    expect(result).not.toContain('auth login');
  });

  it('suggests logging in again for a rejected login credential', () => {
    expect(describeCliAuthFailureSuggestion({ ...BASE, status: 401, credential: LOGIN })).toContain('demo-cli auth login --env dev-mcp');
  });

  it('names the missing scope and the scopes carried for a handoff credential', () => {
    const result = describeCliAuthFailureSuggestion({ ...BASE, status: 403, serverCode: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, credential: HANDOFF });

    expect(result).toContain('lacks the scope');
    expect(result).toContain('`openid demo model.read`');
    expect(result).toContain('without narrowing `scopes`');
  });

  it('recognizes the endpoint missing-scope code too', () => {
    const result = describeCliAuthFailureSuggestion({ ...BASE, status: 403, serverCode: MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE, credential: LOGIN });

    expect(result).toContain('lacks the scope');
    expect(result).toContain("env's scopes");
  });

  it('blames the role, not the credential, for any other 403', () => {
    const result = describeCliAuthFailureSuggestion({ ...BASE, status: 403, serverCode: 'FORBIDDEN', credential: HANDOFF });

    expect(result).toContain('lacks the role or permission');
    expect(result).toContain('claims scope was kept');
  });

  it('never suggests auth login for a 403', () => {
    for (const credential of [HANDOFF, LOGIN, undefined]) {
      for (const serverCode of [CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, 'FORBIDDEN', undefined]) {
        expect(describeCliAuthFailureSuggestion({ ...BASE, status: 403, serverCode, credential })).not.toContain('auth login');
      }
    }
  });

  it('returns nothing for other statuses', () => {
    expect(describeCliAuthFailureSuggestion({ ...BASE, status: 500 })).toBeUndefined();
  });
});

describe('cliAuthFailureErrorMapper', () => {
  afterEach(() => {
    setCliContext(undefined);
  });

  function setContext() {
    setCliContext(
      createCliContext({
        cliName: 'demo-cli',
        envName: 'dev-mcp',
        env: { apiBaseUrl: 'http://x/api', oidcIssuer: 'http://x/oidc', clientId: 'id', redirectUri: 'urn:cb' },
        accessToken: 'token',
        scope: 'openid demo model.read',
        credential: { ...HANDOFF, expiresAt: Date.now() + 600_000 }
      })
    );
  }

  it('rewrites the suggestion of a 403 from the credential in context', () => {
    setContext();

    const result = cliAuthFailureErrorMapper(new CliHttpError({ message: 'forbidden', code: 'AUTH_FORBIDDEN', status: 403, serverCode: CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE }));

    expect(result).toMatchObject({ ok: false, code: 'AUTH_FORBIDDEN' });
    expect(result?.suggestion).toContain('lacks the scope');
  });

  it('ignores errors that are not a 401/403 CliHttpError', () => {
    setContext();

    expect(cliAuthFailureErrorMapper(new CliError({ message: 'x', code: 'AUTH_FORBIDDEN' }))).toBeUndefined();
    expect(cliAuthFailureErrorMapper(new CliHttpError({ message: 'x', code: 'API_ERROR', status: 500 }))).toBeUndefined();
    expect(cliAuthFailureErrorMapper(new Error('x'))).toBeUndefined();
  });
});
