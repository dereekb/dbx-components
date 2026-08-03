import { demoCallModel } from './../model/crud.functions';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOOM, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds, waitForMs } from '@dereekb/util';
import { USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE, USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE, type UserExternalConnectionCredentials, type UserExternalConnectionCredentialsRefresher, type UserExternalConnectionReader, type UserExternalConnectionRefreshCredentialsInput, type UserExternalConnectionServerActions, userExternalConnectionReader } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoUserExternalConnectionContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';

/**
 * Provider-specific values Zoho needs to USE a set of credentials and to send the NEXT refresh to the
 * datacenter that issued the grant. Carried by the tests that prove the merge does not drop them.
 */
const ZOHO_STYLE_EXTRA = { accountsServer: 'https://accounts.zoho.com', apiDomain: 'https://www.zohoapis.com' };

/**
 * Credentials that are already past their stated expiration.
 *
 * @param overrides - Values to apply over the defaults.
 * @returns Expired credentials.
 */
function expiredTestCredentials(overrides: Partial<UserExternalConnectionCredentials> = {}): UserExternalConnectionCredentials {
  return demoUserExternalConnectionTestCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString(), ...overrides });
}

/**
 * Credentials shaped like a refresh RESPONSE: a new access token and nothing the provider did not
 * resend. Providers that issue a refresh token only on first consent (Zoho) answer this way.
 *
 * @param credentials - The values the provider returned. Only `accessToken` is required.
 * @returns The credentials the refresher resolves with.
 */
function refreshedTestCredentials(credentials: Partial<UserExternalConnectionCredentials> & Pick<UserExternalConnectionCredentials, 'accessToken'>): UserExternalConnectionCredentials {
  return { issuedAt: new Date().toISOString(), ...credentials };
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

/**
 * How the refresher a {@link TestReader} is built with should behave.
 */
interface TestReaderConfig {
  /**
   * What the refresher resolves with. Omit for a reader with NO refresher at all; pass `'none'` for a
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
  readonly refreshDelayMs?: Milliseconds;
}

interface TestReader {
  readonly reader: UserExternalConnectionReader;
  /**
   * Every input the refresher was called with.
   */
  readonly refreshInputs: UserExternalConnectionRefreshCredentialsInput[];
}

/**
 * Integration coverage for the reader against the real, emulator-backed connection pair.
 *
 * The reader's policy — what counts as usable, when to renew, what to persist, what to record on a
 * failure — is exercised here rather than over stubs, because every one of those decisions is only
 * meaningful in terms of what ends up in the two documents. So the readers below are built over the
 * app's REAL accessor and server actions: reads come out of the ENCRYPTED private document and every
 * write goes through the real paired transaction.
 *
 * The ONE thing faked is the provider's token exchange, which cannot be real in a test at all. That is
 * what `testReader()` controls; `f.userExternalConnectionReader` is the app's own reader, wired to the
 * registry-backed refresher, and is used wherever the refresh outcome does not need to be steered.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('userExternalConnectionReader', { f, fns: { demoCallModel } }, () => {
    /**
     * Builds a reader over the app's real collaborators, with a refresher we control.
     *
     * @param config - How the refresher should behave.
     * @returns The reader plus every input its refresher saw.
     */
    function testReader(config: TestReaderConfig = {}): TestReader {
      const refreshInputs: UserExternalConnectionRefreshCredentialsInput[] = [];
      let refresher: Maybe<UserExternalConnectionCredentialsRefresher>;

      if (config.refreshResult !== undefined || config.refreshError != null) {
        refresher = {
          refreshUserExternalConnectionCredentials: async (input) => {
            refreshInputs.push(input);

            if (config.refreshDelayMs != null) {
              await waitForMs(config.refreshDelayMs);
            }

            if (config.refreshError != null) {
              throw config.refreshError;
            }

            return config.refreshResult === 'none' ? null : config.refreshResult;
          }
        };
      }

      const reader = userExternalConnectionReader({
        accessor: f.userExternalConnectionAccessor,
        actions: f.userExternalConnectionServerActions,
        refresher
      });

      return { reader, refreshInputs };
    }

    it('should be provided by the app', () => {
      expect(f.userExternalConnectionReader).toBeDefined();
    });

    demoAuthorizedUserContext({ f }, (u) => {
      function readParams(providerType: UserExternalConnectionProviderType = CALCOM) {
        return { uid: u.uid, providerType };
      }

      demoUserExternalConnectionContext({ f, u }, (uec) => {
        describe('readUserExternalConnectionForProvider()', () => {
          it('should return both halves decrypted from the real pair', async () => {
            await uec.connect({ providerType: CALCOM, credentials: demoUserExternalConnectionTestCredentials({ extra: ZOHO_STYLE_EXTRA }) });

            const result = await f.userExternalConnectionReader.readUserExternalConnectionForProvider(readParams());

            expect(result.entry?.st).toBe('connected');
            expect(result.entry?.ea).toBe('cal-123');
            expect(result.credentials?.accessToken).toBe('access-token');
            expect(result.credentials?.refreshToken).toBe('refresh-token');
            // proves the whole credentials map survived the encrypted round trip, not just the token
            expect(result.credentials?.extra?.accountsServer).toBe('https://accounts.zoho.com');
          });

          it('should return both halves as null for a provider the user never connected', async () => {
            await uec.connect({ providerType: CALCOM });

            const result = await f.userExternalConnectionReader.readUserExternalConnectionForProvider(readParams(ZOOM));

            expect(result.entry).not.toBeTruthy();
            expect(result.credentials).not.toBeTruthy();
          });
        });

        describe('readUserExternalConnectionCredentials()', () => {
          it('should return expired credentials without refreshing or throwing', async () => {
            await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

            const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
            const result = await reader.readUserExternalConnectionCredentials(readParams());

            // the raw read applies no policy at all
            expect(result?.accessToken).toBe('access-token');
            expect(refreshInputs).toHaveLength(0);
          });
        });

        describe('readUsableUserExternalConnectionCredentials()', () => {
          describe('not connected', () => {
            it('should throw for a user with no connection document at all', async () => {
              const code = await errorCodeFor(() => f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams()));
              expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
            });

            it('should throw for a provider the user is not connected to', async () => {
              await uec.createUserExternalConnection();

              const code = await errorCodeFor(() => f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams()));
              expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
            });

            it('should throw after a disconnect', async () => {
              await uec.connect({ providerType: CALCOM });
              await uec.disconnect({ providerType: CALCOM, retainEntry: true });

              const code = await errorCodeFor(() => f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams()));
              expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
            });

            it('should throw when the entry says connected but the private half is gone', async () => {
              // a state no supported write can produce — the pair is only ever written together — but a
              // caller still cannot act on it, so it must read as "not connected" rather than crash
              await uec.connect({ providerType: CALCOM });
              await uec.deleteUserExternalConnectionPrivate();

              expect((await uec.loadUserExternalConnection())?.e[CALCOM].st).toBe('connected');

              const code = await errorCodeFor(() => f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams()));
              expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
            });
          });

          describe('expiration', () => {
            it('should return the stored credentials unchanged when they are not near expiring', async () => {
              await uec.connect({ providerType: CALCOM });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('access-token');
              expect(refreshInputs).toHaveLength(0);
              // nothing was written, so the stored token is still the one that was connected
              expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM].accessToken).toBe('access-token');
            });

            it('should treat credentials with NO stated expiration as usable', async () => {
              // some providers issue long-lived tokens and simply do not say when they end. Reading that
              // as expired would refresh on every single call.
              await uec.connect({ providerType: CALCOM, credentials: demoUserExternalConnectionTestCredentials({ expiresAt: undefined }) });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('access-token');
              expect(refreshInputs).toHaveLength(0);
            });

            it('should refresh credentials that expire inside the leeway window', async () => {
              // still valid by the clock, but would expire mid-flight
              await uec.connect({ providerType: CALCOM, credentials: demoUserExternalConnectionTestCredentials({ expiresAt: new Date(Date.now() + MS_IN_SECOND * 10).toISOString() }) });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('refreshed-access-token');
              expect(refreshInputs).toHaveLength(1);
            });

            it('should record the connection as errored when the credentials expired and no refresher was configured', async () => {
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader } = testReader();
              expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(readParams()))).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);

              // an unusable connection is recorded as such whichever way renewal was unavailable
              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[CALCOM].st).toBe('error');
              expect(publicData?.e[CALCOM].er).toBe('expired');
              expect(publicData?.c).not.toContain(CALCOM);
            });

            it('should record the connection as errored when the provider reports no refresh path', async () => {
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader } = testReader({ refreshResult: 'none' });
              expect(await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(readParams()))).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);

              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[CALCOM].st).toBe('error');
              expect(publicData?.e[CALCOM].er).toBe('expired');
              // the credentials are RETAINED on an error outcome, so the connection stays repairable
              expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM]?.refreshToken).toBe('refresh-token');
            });

            it('should NOT rewrite an entry that already records the same failure', async () => {
              // otherwise a hot read path against an unrenewable connection writes a transaction per call
              // to say what the document already says
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader } = testReader({ refreshResult: 'none' });
              await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(readParams()));

              const afterFirst = await uec.loadUserExternalConnection();
              expect(afterFirst?.e[CALCOM].er).toBe('expired');

              await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(readParams()));

              // an untouched updated-at is the proof no second write happened
              const afterSecond = await uec.loadUserExternalConnection();
              expect(afterSecond?.e[CALCOM].uat?.toISOString()).toBe(afterFirst?.e[CALCOM].uat?.toISOString());
              expect(afterSecond?.uat?.toISOString()).toBe(afterFirst?.uat?.toISOString());
            });

            it('should update an entry recording a DIFFERENT failure', async () => {
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });
              await uec.markError({ providerType: CALCOM, error: 'insufficient_scope' });

              const { reader } = testReader({ refreshResult: 'none' });
              await errorCodeFor(() => reader.readUsableUserExternalConnectionCredentials(readParams()));

              expect((await uec.loadUserExternalConnection())?.e[CALCOM].er).toBe('expired');
            });
          });

          describe('refresh', () => {
            it('should persist the refreshed credentials through the paired write', async () => {
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('refreshed-access-token');
              // both halves moved, from the one refresh, through the real transaction
              expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM].accessToken).toBe('refreshed-access-token');

              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[CALCOM].st).toBe('connected');
              expect(publicData?.c).toContain(CALCOM);
            });

            it('should retain the stored refresh token and extra when the refresh omitted them', async () => {
              // the whole reason the merge exists: the paired write replaces credentials wholesale, so a
              // response that omitted these would erase them and brick the NEXT refresh
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials({ extra: ZOHO_STYLE_EXTRA }) });

              const { reader } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.refreshToken).toBe('refresh-token');
              expect(result.extra?.accountsServer).toBe('https://accounts.zoho.com');
              expect(result.externalAccountId).toBe('cal-123');
              expect(result.label).toBe('user@example.com');

              // and what was retained is what a LATER refresh will read back out of the store
              const storedCredentials = (await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM];
              expect(storedCredentials?.accessToken).toBe('refreshed-access-token');
              expect(storedCredentials?.refreshToken).toBe('refresh-token');
              expect(storedCredentials?.extra?.accountsServer).toBe('https://accounts.zoho.com');
              expect(storedCredentials?.extra?.apiDomain).toBe('https://www.zohoapis.com');
            });

            it('should pass the stored credentials to the refresher', async () => {
              // Zoho's refresh needs `extra.accountsServer`, so the refresher gets the whole credentials
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials({ extra: ZOHO_STYLE_EXTRA }) });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }) });
              await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(refreshInputs).toHaveLength(1);
              expect(refreshInputs[0].credentials.refreshToken).toBe('refresh-token');
              expect(refreshInputs[0].credentials.extra?.accountsServer).toBe('https://accounts.zoho.com');
            });

            it('should mark the connection errored and rethrow when the refresh fails', async () => {
              // leaving the entry `connected` after a failed refresh would present a connection that
              // cannot be used and does not look broken
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader } = testReader({ refreshError: new Error('invalid_grant') });
              await expect(reader.readUsableUserExternalConnectionCredentials(readParams())).rejects.toThrow('invalid_grant');

              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[CALCOM].st).toBe('error');
              expect(publicData?.e[CALCOM].er).toBe('expired');
              // nothing was persisted from the failed exchange
              expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM].accessToken).toBe('access-token');
            });

            it('should share ONE refresh between concurrent callers', async () => {
              // for a provider that rotates its refresh token, a second exchange sent with a token the
              // first already spent destroys one of two valid grants
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'refreshed-access-token' }), refreshDelayMs: 20 });
              const results = await Promise.all([reader.readUsableUserExternalConnectionCredentials(readParams()), reader.readUsableUserExternalConnectionCredentials(readParams()), reader.readUsableUserExternalConnectionCredentials(readParams())]);

              expect(refreshInputs).toHaveLength(1);
              results.forEach((x) => expect(x.accessToken).toBe('refreshed-access-token'));
              expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM].accessToken).toBe('refreshed-access-token');
            });

            it('should refresh again after an earlier refresh settled', async () => {
              // the in-flight entry is cleared on settle, so this is a fresh refresh rather than a cached
              // one. The refresh returns credentials that are THEMSELVES expired, so the second read has
              // something left to renew.
              await uec.connect({ providerType: CALCOM, credentials: expiredTestCredentials() });

              const { reader, refreshInputs } = testReader({ refreshResult: expiredTestCredentials({ accessToken: 'refreshed-access-token' }) });

              await reader.readUsableUserExternalConnectionCredentials(readParams());
              await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(refreshInputs).toHaveLength(2);
              // the second refresh read the FIRST refresh's result out of the store
              expect(refreshInputs[1].credentials.accessToken).toBe('refreshed-access-token');
            });
          });

          describe('error status', () => {
            it('should refresh an errored entry so the connection can be repaired', async () => {
              // credentials are deliberately retained on an `error` outcome precisely so this can happen
              await uec.connect({ providerType: CALCOM });
              await uec.markError({ providerType: CALCOM, error: 'unauthorized' });

              const { reader, refreshInputs } = testReader({ refreshResult: refreshedTestCredentials({ accessToken: 'repaired-access-token' }) });
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('repaired-access-token');
              expect(refreshInputs).toHaveLength(1);

              // the connection is back, and queryable again
              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[CALCOM].st).toBe('connected');
              expect(publicData?.e[CALCOM].er).not.toBeDefined();
              expect(publicData?.c).toContain(CALCOM);
            });

            it('should return unexpired credentials for an errored entry when there is no refresher', async () => {
              // the recorded error may have been a scope refusal that leaves the token usable elsewhere
              await uec.connect({ providerType: CALCOM });
              await uec.markError({ providerType: CALCOM, error: 'insufficient_scope' });

              const { reader } = testReader();
              const result = await reader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('access-token');
              // and the entry is left exactly as it was
              expect((await uec.loadUserExternalConnection())?.e[CALCOM].er).toBe('insufficient_scope');
            });
          });

          describe('through the app reader', () => {
            it('should return the stored credentials while they are live', async () => {
              await uec.connect({ providerType: CALCOM });

              const result = await f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams());

              expect(result.accessToken).toBe('access-token');
            });

            it('should mark the connection errored when expired credentials cannot be renewed', async () => {
              // `zoom` has no registered OAuth service in this app, so the registry-backed refresher the
              // app wires in reports no refresh path — the reader must record that rather than hand back
              // a dead token
              await uec.connect({ providerType: ZOOM, credentials: expiredTestCredentials() });

              const code = await errorCodeFor(() => f.userExternalConnectionReader.readUsableUserExternalConnectionCredentials(readParams(ZOOM)));
              expect(code).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);

              const publicData = await uec.loadUserExternalConnection();
              expect(publicData?.e[ZOOM].st).toBe('error');
              expect(publicData?.e[ZOOM].er).toBe('expired');
              // dropped from the queryable array the moment it stopped being usable
              expect(publicData?.c).not.toContain(ZOOM);

              expect((await uec.loadUserExternalConnectionPrivate())?.cr[ZOOM]?.refreshToken).toBe('refresh-token');
            });
          });
        });

        describe('reportUserExternalConnectionFailure()', () => {
          it('should move the entry to the error status on both halves', async () => {
            await uec.connect({ providerType: CALCOM });

            await f.userExternalConnectionReader.reportUserExternalConnectionFailure({ ...readParams(), error: 'unauthorized' });

            const publicData = await uec.loadUserExternalConnection();
            expect(publicData?.e[CALCOM].st).toBe('error');
            expect(publicData?.e[CALCOM].er).toBe('unauthorized');
            expect(publicData?.c).not.toContain(CALCOM);

            expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM]?.accessToken).toBe('access-token');
          });

          it('should record the given code', async () => {
            await uec.connect({ providerType: CALCOM });

            await f.userExternalConnectionReader.reportUserExternalConnectionFailure({ ...readParams(), error: 'insufficient_scope' });

            expect((await uec.loadUserExternalConnection())?.e[CALCOM].er).toBe('insufficient_scope');
          });

          it('should default to unauthorized', async () => {
            await uec.connect({ providerType: CALCOM });

            await f.userExternalConnectionReader.reportUserExternalConnectionFailure(readParams());

            expect((await uec.loadUserExternalConnection())?.e[CALCOM].er).toBe('unauthorized');
          });

          it('should not throw when marking the error fails', async () => {
            // the caller is already handling a failure; losing it to this one would be worse. A write
            // that fails is the one thing the real actions cannot be asked to do, so they are stubbed
            // for this case alone.
            const actions = {
              markUserExternalConnectionError: async () => {
                throw new Error('write failed');
              }
            } as unknown as UserExternalConnectionServerActions;

            const reader = userExternalConnectionReader({ accessor: f.userExternalConnectionAccessor, actions });

            await expect(reader.reportUserExternalConnectionFailure(readParams())).resolves.toBeUndefined();
          });
        });
      });
    });
  });
});
