import { describe, expect, it } from 'vitest';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { type UserExternalConnectionEntry, type UserExternalConnectionEntryStatus, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { type UserExternalConnectionAccessor, type UserExternalConnectionForProvider } from './userexternalconnection.accessor.server';
import { type UserExternalConnectionServerActions } from './userexternalconnection.action.server';
import { type UserExternalConnectionCredentials } from './userexternalconnection.private';
import { type UserExternalConnectionCredentialsRefresher, type UserExternalConnectionRefreshCredentialsInput } from './userexternalconnection.refresh.server';
import { USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE, USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE } from './userexternalconnection.error';
import { userExternalConnectionReader } from './userexternalconnection.reader.server';

const TEST_UID = 'test-uid';
const TEST_PROVIDER_TYPE = 'testprovider';

interface CapturedRefreshWrite {
  readonly uid: string;
  readonly providerType: string;
  readonly credentials: UserExternalConnectionCredentials;
}

interface CapturedError {
  readonly uid: string;
  readonly providerType: string;
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
}

interface TestReaderConfig {
  readonly entry?: Maybe<UserExternalConnectionEntry>;
  readonly credentials?: Maybe<UserExternalConnectionCredentials>;
  /**
   * What the refresher resolves with. Omit for a reader with NO refresher at all; pass null for a
   * refresher that reports the provider has no refresh path.
   */
  readonly refreshResult?: Maybe<UserExternalConnectionCredentials> | 'none';
  /**
   * When set, the refresher rejects with this instead of resolving.
   */
  readonly refreshError?: Error;
  /**
   * Delays the refresher's resolution, so concurrent callers overlap.
   */
  readonly refreshDelayMs?: number;
}

interface TestReader {
  readonly reader: ReturnType<typeof userExternalConnectionReader>;
  readonly writes: CapturedRefreshWrite[];
  readonly errors: CapturedError[];
  readonly refreshInputs: UserExternalConnectionRefreshCredentialsInput[];
  readonly reads: { readonly uid: string; readonly providerType: string }[];
}

/**
 * Builds a reader over stub collaborators, capturing every write and refresh.
 *
 * @param config - What the accessor returns and how the refresher behaves.
 * @returns The reader plus the captured calls.
 */
function makeTestReader(config: TestReaderConfig): TestReader {
  const writes: CapturedRefreshWrite[] = [];
  const errors: CapturedError[] = [];
  const refreshInputs: UserExternalConnectionRefreshCredentialsInput[] = [];
  const reads: { uid: string; providerType: string }[] = [];

  const accessor = {
    readUserExternalConnectionForProvider: async (params: { uid: string; providerType: string }): Promise<UserExternalConnectionForProvider> => {
      reads.push(params);
      return { ...params, entry: config.entry, credentials: config.credentials };
    },
    readUserExternalConnectionCredentials: async () => config.credentials
  } as unknown as UserExternalConnectionAccessor;

  const actions = {
    refreshUserExternalConnectionCredentials: async (params: CapturedRefreshWrite) => {
      writes.push(params);
    },
    markUserExternalConnectionError: async (params: CapturedError) => {
      errors.push(params);
    }
  } as unknown as UserExternalConnectionServerActions;

  let refresher: Maybe<UserExternalConnectionCredentialsRefresher>;

  if (config.refreshResult !== undefined || config.refreshError != null) {
    refresher = {
      refreshUserExternalConnectionCredentials: async (input) => {
        refreshInputs.push(input);

        if (config.refreshDelayMs != null) {
          await new Promise((resolve) => setTimeout(resolve, config.refreshDelayMs));
        }

        if (config.refreshError != null) {
          throw config.refreshError;
        }

        return config.refreshResult === 'none' ? null : config.refreshResult;
      }
    };
  }

  return { reader: userExternalConnectionReader({ accessor, actions, refresher }), writes, errors, refreshInputs, reads };
}

function makeEntry(st: UserExternalConnectionEntryStatus, exa?: Maybe<Date>): UserExternalConnectionEntry {
  return { st, uat: new Date(), exa };
}

function makeCredentials(overrides?: Partial<UserExternalConnectionCredentials>): UserExternalConnectionCredentials {
  return {
    accessToken: 'stored-access-token',
    refreshToken: 'stored-refresh-token',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 30).toISOString(),
    scopes: ['scope.a'],
    externalAccountId: 'external-account-id',
    label: 'user@example.com',
    extra: { accountsServer: 'https://accounts.zoho.com', apiDomain: 'https://www.zohoapis.com' },
    ...overrides
  };
}

/**
 * Reads the server error code off a rejected HttpsError.
 *
 * @param fn - The call expected to reject.
 * @returns The error's code, or undefined when it carried none.
 */
async function errorCodeFor(fn: () => Promise<unknown>): Promise<Maybe<string>> {
  let code: Maybe<string>;

  try {
    await fn();
    throw new Error('expected the call to reject, but it resolved');
  } catch (e) {
    code = (e as { details?: { code?: string } }).details?.code;
  }

  return code;
}

describe('userExternalConnectionReader()', () => {
  const params = { uid: TEST_UID, providerType: TEST_PROVIDER_TYPE };

  describe('readUsableUserExternalConnectionCredentials()', () => {
    describe('not connected', () => {
      it('should throw when the user has no entry for the provider', async () => {
        const { reader } = makeTestReader({ entry: null, credentials: null });
        expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params))).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
      });

      it('should throw when the entry is disconnected', async () => {
        const { reader } = makeTestReader({ entry: makeEntry('disconnected'), credentials: null });
        expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params))).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
      });

      it('should throw when the entry says connected but no credentials are stored', async () => {
        // a state the paired write makes unreachable, but a caller still cannot act on it
        const { reader } = makeTestReader({ entry: makeEntry('connected'), credentials: null });
        expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params))).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
      });
    });

    describe('expiration', () => {
      it('should return the stored credentials unchanged when they are not near expiring', async () => {
        const credentials = makeCredentials();
        const { reader, writes, refreshInputs } = makeTestReader({ entry: makeEntry('connected'), credentials, refreshResult: makeCredentials({ accessToken: 'refreshed' }) });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('stored-access-token');
        expect(refreshInputs).toHaveLength(0);
        expect(writes).toHaveLength(0);
      });

      it('should treat credentials with NO stated expiration as usable', async () => {
        // some providers issue long-lived tokens and simply do not say when they end. Reading that as
        // expired would refresh on every single call.
        const credentials = makeCredentials({ expiresAt: undefined });
        const { reader, refreshInputs } = makeTestReader({ entry: makeEntry('connected'), credentials, refreshResult: makeCredentials({ accessToken: 'refreshed' }) });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('stored-access-token');
        expect(refreshInputs).toHaveLength(0);
      });

      it('should refresh credentials that expire inside the leeway window', async () => {
        // still valid by the clock, but would expire mid-flight
        const credentials = makeCredentials({ expiresAt: new Date(Date.now() + MS_IN_SECOND * 10).toISOString() });
        const { reader, refreshInputs } = makeTestReader({ entry: makeEntry('connected'), credentials, refreshResult: makeCredentials({ accessToken: 'refreshed-access-token' }) });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('refreshed-access-token');
        expect(refreshInputs).toHaveLength(1);
      });

      it('should throw when the credentials expired and no refresher was configured', async () => {
        const credentials = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });
        const { reader, errors } = makeTestReader({ entry: makeEntry('connected'), credentials });

        expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params))).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);
        // an unusable connection is recorded as such whichever way renewal was unavailable
        expect(errors).toHaveLength(1);
        expect(errors[0].error).toBe('expired');
      });

      it('should throw when the provider reports no refresh path', async () => {
        const credentials = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });
        const { reader, errors } = makeTestReader({ entry: makeEntry('connected'), credentials, refreshResult: 'none' });

        expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params))).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);
        expect(errors).toHaveLength(1);
      });

      it('should NOT rewrite an entry that already records the same failure', async () => {
        // otherwise a hot read path against an unrenewable connection writes a transaction per call to
        // say what the document already says
        const credentials = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });
        const entry = { ...makeEntry('error'), er: 'expired' as const };
        const { reader, errors } = makeTestReader({ entry, credentials, refreshResult: 'none' });

        await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params));

        expect(errors).toHaveLength(0);
      });

      it('should update an entry recording a DIFFERENT failure', async () => {
        const credentials = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });
        const entry = { ...makeEntry('error'), er: 'insufficient_scope' as const };
        const { reader, errors } = makeTestReader({ entry, credentials, refreshResult: 'none' });

        await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(params));

        expect(errors).toHaveLength(1);
        expect(errors[0].error).toBe('expired');
      });
    });

    describe('refresh', () => {
      const expired = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });

      it('should persist the refreshed credentials through the paired write', async () => {
        const { reader, writes } = makeTestReader({
          entry: makeEntry('connected'),
          credentials: expired,
          refreshResult: { accessToken: 'refreshed-access-token', issuedAt: new Date().toISOString() }
        });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('refreshed-access-token');
        expect(writes).toHaveLength(1);
        expect(writes[0].uid).toBe(TEST_UID);
        expect(writes[0].providerType).toBe(TEST_PROVIDER_TYPE);
        expect(writes[0].credentials.accessToken).toBe('refreshed-access-token');
      });

      it('should retain the stored refresh token and extra when the refresh omitted them', async () => {
        // the whole reason the merge exists: the paired write replaces credentials wholesale, so a
        // response that omitted these would erase them and brick the NEXT refresh
        const { reader, writes } = makeTestReader({
          entry: makeEntry('connected'),
          credentials: expired,
          refreshResult: { accessToken: 'refreshed-access-token', issuedAt: new Date().toISOString() }
        });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.refreshToken).toBe('stored-refresh-token');
        expect(result.extra?.accountsServer).toBe('https://accounts.zoho.com');
        expect(result.externalAccountId).toBe('external-account-id');
        expect(result.label).toBe('user@example.com');
        expect(writes[0].credentials.refreshToken).toBe('stored-refresh-token');
      });

      it('should pass the stored credentials to the refresher', async () => {
        // Zoho's refresh needs `extra.accountsServer`, so the refresher gets the whole credentials
        const { reader, refreshInputs } = makeTestReader({ entry: makeEntry('connected'), credentials: expired, refreshResult: makeCredentials() });

        await reader.readUsableUserExternalConnectionCredentials(params);

        expect(refreshInputs).toHaveLength(1);
        expect(refreshInputs[0].credentials.refreshToken).toBe('stored-refresh-token');
        expect(refreshInputs[0].credentials.extra?.accountsServer).toBe('https://accounts.zoho.com');
      });

      it('should mark the connection errored and rethrow when the refresh fails', async () => {
        // leaving the entry `connected` after a failed refresh would present a connection that cannot
        // be used and does not look broken
        const refreshError = new Error('invalid_grant');
        const { reader, errors, writes } = makeTestReader({ entry: makeEntry('connected'), credentials: expired, refreshError });

        await expect(reader.readUsableUserExternalConnectionCredentials(params)).rejects.toThrow('invalid_grant');

        expect(writes).toHaveLength(0);
        expect(errors).toHaveLength(1);
        expect(errors[0].error).toBe('expired');
      });

      it('should share ONE refresh between concurrent callers', async () => {
        // for a provider that rotates its refresh token, a second exchange sent with a token the first
        // already spent destroys one of two valid grants
        const { reader, refreshInputs, writes } = makeTestReader({
          entry: makeEntry('connected'),
          credentials: expired,
          refreshResult: { accessToken: 'refreshed-access-token', issuedAt: new Date().toISOString() },
          refreshDelayMs: 20
        });

        const results = await Promise.all([reader.readUsableUserExternalConnectionCredentials(params), reader.readUsableUserExternalConnectionCredentials(params), reader.readUsableUserExternalConnectionCredentials(params)]);

        expect(refreshInputs).toHaveLength(1);
        expect(writes).toHaveLength(1);
        results.forEach((x) => expect(x.accessToken).toBe('refreshed-access-token'));
      });

      it('should refresh again after an earlier refresh settled', async () => {
        // the in-flight entry is cleared on settle, so this is a fresh refresh rather than a cached one
        const { reader, refreshInputs } = makeTestReader({
          entry: makeEntry('connected'),
          credentials: expired,
          refreshResult: { accessToken: 'refreshed-access-token', issuedAt: new Date().toISOString() }
        });

        await reader.readUsableUserExternalConnectionCredentials(params);
        await reader.readUsableUserExternalConnectionCredentials(params);

        expect(refreshInputs).toHaveLength(2);
      });
    });

    describe('error status', () => {
      it('should refresh an errored entry so the connection can be repaired', async () => {
        // credentials are deliberately retained on an `error` outcome precisely so this can happen
        const credentials = makeCredentials();
        const { reader, refreshInputs } = makeTestReader({ entry: makeEntry('error'), credentials, refreshResult: { accessToken: 'repaired-access-token', issuedAt: new Date().toISOString() } });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('repaired-access-token');
        expect(refreshInputs).toHaveLength(1);
      });

      it('should return unexpired credentials for an errored entry when there is no refresher', async () => {
        // the recorded error may have been a scope refusal that leaves the token usable for other calls
        const credentials = makeCredentials();
        const { reader } = makeTestReader({ entry: makeEntry('error'), credentials });

        const result = await reader.readUsableUserExternalConnectionCredentials(params);

        expect(result.accessToken).toBe('stored-access-token');
      });
    });
  });

  describe('readUserExternalConnectionCredentials()', () => {
    it('should return expired credentials without refreshing or throwing', async () => {
      const credentials = makeCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() });
      const { reader, refreshInputs } = makeTestReader({ entry: makeEntry('connected'), credentials, refreshResult: makeCredentials() });

      const result = await reader.readUserExternalConnectionCredentials(params);

      expect(result?.accessToken).toBe('stored-access-token');
      expect(refreshInputs).toHaveLength(0);
    });
  });

  describe('reportUserExternalConnectionFailure()', () => {
    it('should mark the connection errored with the given code', async () => {
      const { reader, errors } = makeTestReader({ entry: makeEntry('connected'), credentials: makeCredentials() });

      await reader.reportUserExternalConnectionFailure({ ...params, error: 'insufficient_scope' });

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('insufficient_scope');
    });

    it('should default to unauthorized', async () => {
      const { reader, errors } = makeTestReader({ entry: makeEntry('connected'), credentials: makeCredentials() });

      await reader.reportUserExternalConnectionFailure(params);

      expect(errors[0].error).toBe('unauthorized');
    });

    it('should not throw when marking the error fails', async () => {
      // the caller is already handling a failure; losing it to this one would be worse
      const accessor = { readUserExternalConnectionForProvider: async () => ({}), readUserExternalConnectionCredentials: async () => undefined } as unknown as UserExternalConnectionAccessor;
      const actions = {
        markUserExternalConnectionError: async () => {
          throw new Error('write failed');
        }
      } as unknown as UserExternalConnectionServerActions;

      const reader = userExternalConnectionReader({ accessor, actions });

      await expect(reader.reportUserExternalConnectionFailure(params)).resolves.toBeUndefined();
    });
  });
});
