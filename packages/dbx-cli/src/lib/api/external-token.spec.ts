import { describe, expect, it } from 'vitest';
import {
  USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE
} from '@dereekb/firebase';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../auth/auth-failure.hint';
import { type DescribeExternalConnectionTokenFailureSuggestionInput, describeExternalConnectionTokenFailureSuggestion } from './external-token';

const BASE = { cliName: 'demo-cli', envName: 'dev-mcp', providerType: 'microsoft', scope: 'openid offline_access token.external token.external.microsoft_read' } as const;
const HANDOFF = { handoff: true, refreshable: false };
const LOGIN = { handoff: false, refreshable: true };

const EXCESS = { status: 403, serverCode: USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE, data: { providerType: 'microsoft', excessScopes: ['Mail.ReadWrite', 'Files.ReadWrite'] } };
const NO_EXCESS = { status: 403, serverCode: USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE, data: { providerType: 'microsoft' } };
const MISSING_SCOPE = { status: 403, serverCode: MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE };
const GENERIC_FORBIDDEN = { status: 403, serverCode: USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE };
const UNAUTHORIZED = { status: 401 };

function describeFor(input: Omit<DescribeExternalConnectionTokenFailureSuggestionInput, 'providerType' | 'cliName' | 'envName'> & { readonly scope?: string }, credential: { readonly handoff: boolean; readonly refreshable: boolean }): string {
  return describeExternalConnectionTokenFailureSuggestion({ ...BASE, ...input, credential }) ?? '';
}

describe('describeExternalConnectionTokenFailureSuggestion()', () => {
  describe('handoff credentials', () => {
    const rows = { UNAUTHORIZED, EXCESS, NO_EXCESS, MISSING_SCOPE, GENERIC_FORBIDDEN };

    for (const [name, row] of Object.entries(rows)) {
      it(`tells a handoff credential to re-mint, never to log in (${name})`, () => {
        const result = describeFor(row, HANDOFF);
        expect(result).toContain('_cli_token');
        expect(result).toContain('demo-cli auth handoff <code> --env dev-mcp');
        expect(result).not.toContain('auth login');
      });
    }
  });

  describe('login credentials', () => {
    const rows = { UNAUTHORIZED, EXCESS, NO_EXCESS, MISSING_SCOPE, GENERIC_FORBIDDEN };

    for (const [name, row] of Object.entries(rows)) {
      it(`tells a login credential to log in (${name})`, () => {
        const result = describeFor(row, LOGIN);
        expect(result).toContain('auth login');
        expect(result).not.toContain('auth handoff');
      });
    }

    it('names the env on a 401', () => {
      expect(describeFor(UNAUTHORIZED, LOGIN)).toContain('demo-cli auth login --env dev-mcp');
    });
  });

  it('names each excess scope and the narrower access level', () => {
    for (const credential of [HANDOFF, LOGIN]) {
      const result = describeFor(EXCESS, credential);
      expect(result).toContain('Mail.ReadWrite');
      expect(result).toContain('Files.ReadWrite');
      expect(result).toContain('narrower access level');
    }
  });

  it('lists only the token.external scopes the credential carries', () => {
    const result = describeFor(NO_EXCESS, HANDOFF);
    expect(result).toContain('It carries `token.external token.external.microsoft_read`.');
    expect(result).not.toContain('offline_access');
  });

  it('says so when the credential carries no token.external scope', () => {
    expect(describeFor({ ...MISSING_SCOPE, scope: 'openid demo' }, LOGIN)).toContain('It carries no `token.external` scope.');
  });

  it('falls back to the no-excess hint on malformed data', () => {
    for (const data of [{ excessScopes: 'Mail.ReadWrite' }, { excessScopes: ['Mail.ReadWrite', 3] }, { excessScopes: [] }, 'x', null]) {
      const result = describeFor({ ...NO_EXCESS, data }, LOGIN);
      expect(result).toContain('holds none of the');
      expect(result).not.toContain('narrower access level');
    }
  });

  it('says logging in again will not help when the provider is not exportable', () => {
    for (const credential of [HANDOFF, LOGIN]) {
      expect(describeFor({ status: 403, serverCode: USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE }, credential)).toContain('does not allow exporting "microsoft" tokens');
    }
  });

  it('tells the user to reconnect when the stored credentials expired', () => {
    expect(describeFor({ status: 409, serverCode: USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE }, HANDOFF)).toContain('stored credentials expired');
  });

  it('tells the user to connect the provider on a 404 or another 409', () => {
    expect(describeFor({ status: 404 }, LOGIN)).toContain('Connect your "microsoft" account');
    expect(describeFor({ status: 409, serverCode: USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE }, LOGIN)).toContain('Connect your "microsoft" account');
  });

  it('returns undefined for any other status', () => {
    expect(describeExternalConnectionTokenFailureSuggestion({ ...BASE, status: 500 })).toBeUndefined();
  });
});
