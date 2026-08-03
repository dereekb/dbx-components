import { demoCallModel } from './../model/crud.functions';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOOM, type UserExternalConnection } from '@dereekb/firebase';
import { MS_IN_MINUTE, type Maybe } from '@dereekb/util';
import { USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE, USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE, type UserExternalConnectionCredentials, type UserExternalConnectionPrivate, UserExternalConnectionReader, UserExternalConnectionServerActions, UserExternalConnectionServerFirestoreCollections } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

function testCredentials(overrides: Partial<UserExternalConnectionCredentials> = {}): UserExternalConnectionCredentials {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 30).toISOString(),
    scopes: ['booking:read'],
    externalAccountId: 'cal-123',
    label: 'user@example.com',
    extra: { accountsServer: 'https://accounts.zoho.com' },
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

/**
 * Integration coverage for the reader against the real, emulator-backed connection pair.
 *
 * The unit spec in `@dereekb/firebase-server/model` covers the decision logic over stubs. What is only
 * provable here is that the reader reads through the ENCRYPTED private document — the credentials it
 * returns have made a real round trip through `firestoreEncryptedField` — and that the app's DI
 * actually resolves a reader wired to the OAuth provider registry.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('userExternalConnectionReader', { f, fns: { demoCallModel } }, () => {
    function serverActions(): UserExternalConnectionServerActions {
      return f.nest.get(UserExternalConnectionServerActions);
    }

    function reader(): UserExternalConnectionReader {
      return f.nest.get(UserExternalConnectionReader);
    }

    async function loadPublic(uid: string): Promise<Maybe<UserExternalConnection>> {
      return f.instance.demoFirestoreCollections.userExternalConnectionCollection.documentAccessor().loadDocumentForId(uid).snapshotData();
    }

    async function loadPrivate(uid: string): Promise<Maybe<UserExternalConnectionPrivate>> {
      return f.nest.get(UserExternalConnectionServerFirestoreCollections).userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(uid).snapshotData();
    }

    it('should be provided by the app', () => {
      expect(reader()).toBeDefined();
    });

    demoAuthorizedUserContext({ f }, (u) => {
      describe('readUserExternalConnectionForProvider()', () => {
        it('should return both halves decrypted from the real pair', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });

          const result = await reader().readUserExternalConnectionForProvider({ uid: u.uid, providerType: CALCOM });

          expect(result.entry?.st).toBe('connected');
          expect(result.entry?.ea).toBe('cal-123');
          expect(result.credentials?.accessToken).toBe('access-token');
          expect(result.credentials?.refreshToken).toBe('refresh-token');
          // proves the whole credentials map survived the encrypted round trip, not just the token
          expect(result.credentials?.extra?.accountsServer).toBe('https://accounts.zoho.com');
        });

        it('should return both halves as null for a provider the user never connected', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });

          const result = await reader().readUserExternalConnectionForProvider({ uid: u.uid, providerType: ZOOM });

          expect(result.entry).not.toBeTruthy();
          expect(result.credentials).not.toBeTruthy();
        });
      });

      describe('readUsableUserExternalConnectionCredentials()', () => {
        it('should return the stored credentials while they are live', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });

          const result = await reader().readUsableUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM });

          expect(result.accessToken).toBe('access-token');
        });

        it('should throw for a provider the user is not connected to', async () => {
          await serverActions().createUserExternalConnection({ uid: u.uid });

          const code = await errorCodeFor(() => reader().readUsableUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM }));
          expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
        });

        it('should throw for a user with no connection document at all', async () => {
          const code = await errorCodeFor(() => reader().readUsableUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM }));
          expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
        });

        it('should throw after a disconnect', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });
          await serverActions().disconnectUserExternalConnection({ uid: u.uid, providerType: CALCOM, retainEntry: true });

          const code = await errorCodeFor(() => reader().readUsableUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM }));
          expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
        });

        it('should mark the connection errored when expired credentials cannot be renewed', async () => {
          // `zoom` has no registered OAuth service in this app, so the registry-backed refresher reports
          // no refresh path — the reader must record that rather than hand back a dead token
          await serverActions().connectUserExternalConnection({
            uid: u.uid,
            providerType: ZOOM,
            credentials: testCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() })
          });

          const code = await errorCodeFor(() => reader().readUsableUserExternalConnectionCredentials({ uid: u.uid, providerType: ZOOM }));
          expect(code).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);

          const publicData = await loadPublic(u.uid);
          expect(publicData?.e[ZOOM].st).toBe('error');
          expect(publicData?.e[ZOOM].er).toBe('expired');
          // dropped from the queryable array the moment it stopped being usable
          expect(publicData?.c).not.toContain(ZOOM);

          // the credentials are RETAINED on an error outcome, so the connection stays repairable
          expect((await loadPrivate(u.uid))?.cr[ZOOM]?.refreshToken).toBe('refresh-token');
        });
      });

      describe('reportUserExternalConnectionFailure()', () => {
        it('should move the entry to the error status on both halves', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });

          await reader().reportUserExternalConnectionFailure({ uid: u.uid, providerType: CALCOM, error: 'unauthorized' });

          const publicData = await loadPublic(u.uid);
          expect(publicData?.e[CALCOM].st).toBe('error');
          expect(publicData?.e[CALCOM].er).toBe('unauthorized');
          expect(publicData?.c).not.toContain(CALCOM);

          expect((await loadPrivate(u.uid))?.cr[CALCOM]?.accessToken).toBe('access-token');
        });
      });
    });
  });
});
