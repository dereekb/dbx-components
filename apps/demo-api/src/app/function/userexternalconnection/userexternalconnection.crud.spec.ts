import { demoCallModel } from './../model/crud.functions';
import { type DisconnectUserExternalConnectionParams, type ReadUserExternalConnectionAuthorizeStateParams, type UserExternalConnection, type UserExternalConnectionAuthorizeStateResult, onCallReadModelParams, onCallUpdateModelParams, userExternalConnectionIdentity } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionCredentials, type UserExternalConnectionPrivate, UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionServerActions, UserExternalConnectionServerFirestoreCollections, UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

const CALCOM = 'calcom';
const DISCORD = 'discord';
const ZOOM = 'zoom';

function testCredentials(overrides: Partial<UserExternalConnectionCredentials> = {}): UserExternalConnectionCredentials {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    issuedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
    expiresAt: new Date('2026-04-01T01:00:00.000Z').toISOString(),
    scopes: ['booking:read'],
    externalAccountId: 'cal-123',
    label: 'user@example.com',
    ...overrides
  };
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('userExternalConnection', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    function serverActions(): UserExternalConnectionServerActions {
      return f.nest.get(UserExternalConnectionServerActions);
    }

    async function loadPublic(uid: string): Promise<Maybe<UserExternalConnection>> {
      return f.instance.demoFirestoreCollections.userExternalConnectionCollection.documentAccessor().loadDocumentForId(uid).snapshotData();
    }

    async function loadPrivate(uid: string): Promise<Maybe<UserExternalConnectionPrivate>> {
      return f.nest.get(UserExternalConnectionServerFirestoreCollections).userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(uid).snapshotData();
    }

    demoAuthorizedUserContext({ f }, (u) => {
      describe('connect', () => {
        it('should create both documents with the summary derived from the credentials', async () => {
          const credentials = testCredentials();
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials });

          const publicData = await loadPublic(u.uid);
          const privateData = await loadPrivate(u.uid);

          expect(publicData).toBeDefined();
          expect(privateData).toBeDefined();

          expect(publicData?.uid).toBe(u.uid);
          expect(publicData?.e[CALCOM].st).toBe('connected');
          expect(publicData?.e[CALCOM].ca).toEqual(credentials.scopes);
          expect(publicData?.e[CALCOM].ea).toBe(credentials.externalAccountId);
          expect(publicData?.e[CALCOM].l).toBe(credentials.label);
          expect(publicData?.e[CALCOM].exa?.toISOString()).toBe(credentials.expiresAt);
          expect(publicData?.c).toEqual([CALCOM]);

          expect(privateData?.uid).toBe(u.uid);
          expect(privateData?.cr[CALCOM].accessToken).toBe(credentials.accessToken);
          expect(privateData?.cr[CALCOM].refreshToken).toBe(credentials.refreshToken);
        });
      });

      describe('atomicity', () => {
        // A BigInt cannot be JSON.stringify'd, so the private document's converter throws inside
        // encryptValue — AFTER the public document's set() has already been issued on the
        // transaction. Firestore buffers transaction writes until the callback returns, so the
        // correct behavior is that NEITHER document is written.
        const unserializableCredentials = () => testCredentials({ extra: { bad: BigInt(1) as unknown as number } });

        it('should leave neither document created when the paired write fails', async () => {
          await expect(serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: unserializableCredentials() })).rejects.toThrow();

          expect(await loadPublic(u.uid)).not.toBeDefined();
          expect(await loadPrivate(u.uid)).not.toBeDefined();
        });

        it('should leave neither document changed when the paired write fails on an existing pair', async () => {
          const credentials = testCredentials();
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials });

          const publicBefore = await loadPublic(u.uid);
          const privateBefore = await loadPrivate(u.uid);

          await expect(serverActions().connectUserExternalConnection({ uid: u.uid, providerType: ZOOM, credentials: unserializableCredentials() })).rejects.toThrow();

          const publicAfter = await loadPublic(u.uid);
          const privateAfter = await loadPrivate(u.uid);

          expect(Object.keys(publicAfter?.e ?? {})).not.toContain(ZOOM);
          expect(Object.keys(privateAfter?.cr ?? {})).not.toContain(ZOOM);

          expect(publicAfter?.c).toEqual(publicBefore?.c);
          expect(publicAfter?.uat?.toISOString()).toBe(publicBefore?.uat?.toISOString());
          expect(publicAfter?.e[CALCOM].uat?.toISOString()).toBe(publicBefore?.e[CALCOM].uat?.toISOString());
          expect(privateAfter?.cr[CALCOM].accessToken).toBe(privateBefore?.cr[CALCOM].accessToken);
          expect(privateAfter?.uat?.toISOString()).toBe(privateBefore?.uat?.toISOString());
        });
      });

      describe('multiple providers', () => {
        it('should not disturb the first provider in either document when a second is connected', async () => {
          const calcomCredentials = testCredentials();
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: calcomCredentials });

          const publicBefore = await loadPublic(u.uid);
          const privateBefore = await loadPrivate(u.uid);

          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: ZOOM, credentials: testCredentials({ accessToken: 'zoom-access', externalAccountId: 'zoom-456', scopes: ['meeting:write'] }) });

          const publicAfter = await loadPublic(u.uid);
          const privateAfter = await loadPrivate(u.uid);

          expect(publicAfter?.e[CALCOM].ea).toBe(publicBefore?.e[CALCOM].ea);
          expect(publicAfter?.e[CALCOM].ca).toEqual(publicBefore?.e[CALCOM].ca);
          expect(publicAfter?.e[CALCOM].uat?.toISOString()).toBe(publicBefore?.e[CALCOM].uat?.toISOString());
          expect(privateAfter?.cr[CALCOM].accessToken).toBe(privateBefore?.cr[CALCOM].accessToken);

          expect(publicAfter?.e[ZOOM].ea).toBe('zoom-456');
          expect(privateAfter?.cr[ZOOM].accessToken).toBe('zoom-access');
          expect(publicAfter?.c).toContain(CALCOM);
          expect(publicAfter?.c).toContain(ZOOM);
        });

        it('should not disturb the other provider in either document when one is disconnected', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: ZOOM, credentials: testCredentials({ accessToken: 'zoom-access' }) });

          await serverActions().disconnectUserExternalConnection({ uid: u.uid, providerType: ZOOM });

          const publicData = await loadPublic(u.uid);
          const privateData = await loadPrivate(u.uid);

          expect(publicData?.e[CALCOM].st).toBe('connected');
          expect(privateData?.cr[CALCOM].accessToken).toBe('access-token');
          expect(Object.keys(publicData?.e ?? {})).not.toContain(ZOOM);
          expect(Object.keys(privateData?.cr ?? {})).not.toContain(ZOOM);
          expect(publicData?.c).toEqual([CALCOM]);
        });
      });

      describe('connected provider types array', () => {
        it('should move to the expected state across connect, error, disconnect and reconnect', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });
          expect((await loadPublic(u.uid))?.c).toEqual([CALCOM]);

          await serverActions().markUserExternalConnectionError({ uid: u.uid, providerType: CALCOM, error: 'unauthorized' });

          const erroredPublic = await loadPublic(u.uid);
          const erroredPrivate = await loadPrivate(u.uid);

          expect(erroredPublic?.c.length).toBe(0);
          expect(erroredPublic?.e[CALCOM].st).toBe('error');
          expect(erroredPublic?.e[CALCOM].er).toBe('unauthorized');
          // erroring retains the credentials so the connection can be repaired by a refresh.
          expect(erroredPrivate?.cr[CALCOM].accessToken).toBe('access-token');

          await serverActions().refreshUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM, credentials: testCredentials({ accessToken: 'refreshed-access' }) });

          const reconnectedPublic = await loadPublic(u.uid);
          expect(reconnectedPublic?.c).toEqual([CALCOM]);
          expect(reconnectedPublic?.e[CALCOM].st).toBe('connected');
          expect(reconnectedPublic?.e[CALCOM].er).not.toBeDefined();
          expect((await loadPrivate(u.uid))?.cr[CALCOM].accessToken).toBe('refreshed-access');

          await serverActions().disconnectUserExternalConnection({ uid: u.uid, providerType: CALCOM, retainEntry: true });

          const disconnectedPublic = await loadPublic(u.uid);
          expect(disconnectedPublic?.c.length).toBe(0);
          expect(disconnectedPublic?.e[CALCOM].st).toBe('disconnected');
          expect(Object.keys((await loadPrivate(u.uid))?.cr ?? {})).not.toContain(CALCOM);
        });
      });

      describe('readUserExternalConnectionCredentials', () => {
        it('should return the decrypted credentials', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });
          const result = await serverActions().readUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM });

          expect(result?.accessToken).toBe('access-token');
        });

        it('should return nothing for a provider that is not connected', async () => {
          const result = await serverActions().readUserExternalConnectionCredentials({ uid: u.uid, providerType: CALCOM });
          expect(result).not.toBeDefined();
        });
      });

      describe('deleteAllUserExternalConnectionsForUser', () => {
        it('should delete both documents', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });
          await serverActions().deleteAllUserExternalConnectionsForUser({ uid: u.uid });

          expect(await loadPublic(u.uid)).not.toBeDefined();
          expect(await loadPrivate(u.uid)).not.toBeDefined();
        });
      });

      describe('update:disconnect callable', () => {
        it('should disconnect the calling user from the provider', async () => {
          await serverActions().connectUserExternalConnection({ uid: u.uid, providerType: CALCOM, credentials: testCredentials() });

          const params: DisconnectUserExternalConnectionParams = { providerType: CALCOM };
          await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(userExternalConnectionIdentity, params, 'disconnect'));

          const publicData = await loadPublic(u.uid);
          const privateData = await loadPrivate(u.uid);

          expect(Object.keys(publicData?.e ?? {})).not.toContain(CALCOM);
          expect(publicData?.c.length).toBe(0);
          expect(Object.keys(privateData?.cr ?? {})).not.toContain(CALCOM);
        });
      });

      describe('read:authorizeState callable', () => {
        it('should mint a state that resolves back to the calling user', async () => {
          const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: CALCOM };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

          expect(result.state).toBeDefined();
          // only the server can open it, so verify through the coder rather than by inspection
          expect(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: CALCOM })?.uid).toBe(u.uid);
        });

        it('should mint a state for every registered provider, not just the first', async () => {
          const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: DISCORD };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

          expect(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: DISCORD })?.uid).toBe(u.uid);
          // the secret is shared, so a discord state must not open as a calcom one
          expect(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: CALCOM })).toBeUndefined();
        });

        it('should bind the state to the provider it was minted for', async () => {
          const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: CALCOM };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

          // the state secret is shared across providers, so the provider must be bound into the state
          expect(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: ZOOM })).toBeUndefined();
        });

        it('should not embed the uid in a readable form', async () => {
          const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: CALCOM };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

          expect(result.state).not.toContain(u.uid);
        });

        it('should reject a provider with no authorize flow configured', async () => {
          const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: ZOOM };
          await expect(u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))).rejects.toThrow();
        });

        it('should offer exactly the providers whose oauth modules are mounted', () => {
          // the registry is built from the mounted services, so it cannot drift from the modules the
          // app actually imports the way a hand-maintained allowlist could
          const registry = f.nest.get(UserExternalConnectionOAuthProviderRegistry);

          expect(registry.hasAuthorizeFlowForProviderType(CALCOM)).toBe(true);
          expect(registry.hasAuthorizeFlowForProviderType(DISCORD)).toBe(true);
          expect(registry.hasAuthorizeFlowForProviderType(ZOOM)).toBe(false);
        });
      });
    });
  });
});
