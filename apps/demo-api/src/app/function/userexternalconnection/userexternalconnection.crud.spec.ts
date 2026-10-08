import { demoCallModel } from './../model/crud.functions';
import {
  CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM,
  type CreateUserExternalConnectionParams,
  DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD,
  type DisconnectUserExternalConnectionParams,
  type OnCallCreateModelResult,
  type ReadUserExternalConnectionAuthorizeStateParams,
  type UserExternalConnectionAuthorizeStateResult,
  USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE,
  ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO,
  ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOOM,
  onCallCreateModelParams,
  onCallReadModelParams,
  onCallUpdateModelParams,
  userExternalConnectionIdentity
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { UserExternalConnectionOAuthProviderRegistry, UserExternalConnectionStateCoder, type UserExternalConnectionStateActor } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO_ADMIN } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoUserExternalConnectionContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';

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
 * Reads the uid a verified state was minted for. A `signin` state carries none.
 *
 * @param actor - The verified state actor, if the state verified at all.
 * @returns The uid, or undefined for a state that did not verify or names no user.
 */
function stateActorUid(actor: Maybe<UserExternalConnectionStateActor>): Maybe<string> {
  return actor != null && actor.mode !== 'signin' ? actor.uid : undefined;
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('userExternalConnection', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoUserExternalConnectionContext({ f, u }, (uec) => {
        describe('connect', () => {
          it('should create both documents with the summary derived from the credentials', async () => {
            const credentials = demoUserExternalConnectionTestCredentials();
            await uec.connect({ providerType: CALCOM, credentials });

            const publicData = await uec.loadUserExternalConnection();
            const privateData = await uec.loadUserExternalConnectionPrivate();

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
          const unserializableCredentials = () => demoUserExternalConnectionTestCredentials({ extra: { bad: BigInt(1) as unknown as number } });

          it('should leave neither document created when the paired write fails', async () => {
            await expect(uec.connect({ providerType: CALCOM, credentials: unserializableCredentials() })).rejects.toThrow();

            expect(await uec.loadUserExternalConnection()).not.toBeDefined();
            expect(await uec.loadUserExternalConnectionPrivate()).not.toBeDefined();
          });

          it('should leave neither document changed when the paired write fails on an existing pair', async () => {
            await uec.connect({ providerType: CALCOM });

            const publicBefore = await uec.loadUserExternalConnection();
            const privateBefore = await uec.loadUserExternalConnectionPrivate();

            await expect(uec.connect({ providerType: ZOOM, credentials: unserializableCredentials() })).rejects.toThrow();

            const publicAfter = await uec.loadUserExternalConnection();
            const privateAfter = await uec.loadUserExternalConnectionPrivate();

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
            await uec.connect({ providerType: CALCOM });

            const publicBefore = await uec.loadUserExternalConnection();
            const privateBefore = await uec.loadUserExternalConnectionPrivate();

            await uec.connect({ providerType: ZOOM, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'zoom-access', externalAccountId: 'zoom-456', scopes: ['meeting:write'] }) });

            const publicAfter = await uec.loadUserExternalConnection();
            const privateAfter = await uec.loadUserExternalConnectionPrivate();

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
            await uec.connect({ providerType: CALCOM });
            await uec.connect({ providerType: ZOOM, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'zoom-access' }) });

            await uec.disconnect({ providerType: ZOOM });

            const publicData = await uec.loadUserExternalConnection();
            const privateData = await uec.loadUserExternalConnectionPrivate();

            expect(publicData?.e[CALCOM].st).toBe('connected');
            expect(privateData?.cr[CALCOM].accessToken).toBe('access-token');
            expect(Object.keys(publicData?.e ?? {})).not.toContain(ZOOM);
            expect(Object.keys(privateData?.cr ?? {})).not.toContain(ZOOM);
            expect(publicData?.c).toEqual([CALCOM]);
          });
        });

        describe('connected provider types array', () => {
          it('should move to the expected state across connect, error, disconnect and reconnect', async () => {
            await uec.connect({ providerType: CALCOM });
            expect((await uec.loadUserExternalConnection())?.c).toEqual([CALCOM]);

            await uec.markError({ providerType: CALCOM, error: 'unauthorized' });

            const erroredPublic = await uec.loadUserExternalConnection();
            const erroredPrivate = await uec.loadUserExternalConnectionPrivate();

            expect(erroredPublic?.c.length).toBe(0);
            expect(erroredPublic?.e[CALCOM].st).toBe('error');
            expect(erroredPublic?.e[CALCOM].er).toBe('unauthorized');
            // erroring retains the credentials so the connection can be repaired by a refresh.
            expect(erroredPrivate?.cr[CALCOM].accessToken).toBe('access-token');

            await uec.refreshCredentials({ providerType: CALCOM, credentials: demoUserExternalConnectionTestCredentials({ accessToken: 'refreshed-access' }) });

            const reconnectedPublic = await uec.loadUserExternalConnection();
            expect(reconnectedPublic?.c).toEqual([CALCOM]);
            expect(reconnectedPublic?.e[CALCOM].st).toBe('connected');
            expect(reconnectedPublic?.e[CALCOM].er).not.toBeDefined();
            expect((await uec.loadUserExternalConnectionPrivate())?.cr[CALCOM].accessToken).toBe('refreshed-access');

            await uec.disconnect({ providerType: CALCOM, retainEntry: true });

            const disconnectedPublic = await uec.loadUserExternalConnection();
            expect(disconnectedPublic?.c.length).toBe(0);
            expect(disconnectedPublic?.e[CALCOM].st).toBe('disconnected');
            expect(Object.keys((await uec.loadUserExternalConnectionPrivate())?.cr ?? {})).not.toContain(CALCOM);
          });
        });

        describe('readUserExternalConnectionCredentials', () => {
          it('should return the decrypted credentials', async () => {
            await uec.connect({ providerType: CALCOM });
            const result = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(CALCOM).readUserExternalConnectionCredentials();

            expect(result?.accessToken).toBe('access-token');
          });

          it('should return nothing for a provider that is not connected', async () => {
            const result = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(CALCOM).readUserExternalConnectionCredentials();
            expect(result).not.toBeDefined();
          });
        });

        describe('readUserExternalConnectionForProvider', () => {
          it('should return both halves for a connected provider', async () => {
            await uec.connect({ providerType: CALCOM });
            const result = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(CALCOM).readUserExternalConnectionForProvider();

            expect(result.entry?.st).toBe('connected');
            expect(result.credentials?.accessToken).toBe('access-token');
          });

          it('should return both halves as null when the user has no connection document', async () => {
            const result = await f.userExternalConnectionAccessor.accessorForUser({ uid: u.uid })(CALCOM).readUserExternalConnectionForProvider();

            expect(result.entry).not.toBeTruthy();
            expect(result.credentials).not.toBeTruthy();
          });
        });

        describe('deleteAllUserExternalConnectionsForUser', () => {
          it('should delete both documents', async () => {
            await uec.connect({ providerType: CALCOM });
            await uec.deleteAllUserExternalConnections();

            expect(await uec.loadUserExternalConnection()).not.toBeDefined();
            expect(await uec.loadUserExternalConnectionPrivate()).not.toBeDefined();
          });
        });

        describe('create callable', () => {
          function callCreate() {
            const params: CreateUserExternalConnectionParams = {};
            return u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(userExternalConnectionIdentity, params));
          }

          it('should create the calling user an empty connection document', async () => {
            expect(await uec.loadUserExternalConnection()).not.toBeDefined();

            const result = (await callCreate()) as OnCallCreateModelResult;
            expect(result.modelKeys.length).toBe(1);

            const publicData = await uec.loadUserExternalConnection();

            expect(publicData).toBeDefined();
            expect(publicData?.uid).toBe(u.uid);
            expect(Object.keys(publicData?.e ?? {}).length).toBe(0);
            expect(publicData?.c.length).toBe(0);
          });

          it('should not create the private half until a provider is connected', async () => {
            await callCreate();

            // the private document exists only to hold credentials, and creation has none to store
            expect(await uec.loadUserExternalConnectionPrivate()).not.toBeDefined();
          });

          it('should reject a second create for the same user', async () => {
            await callCreate();
            await expect(callCreate()).rejects.toThrow();
          });

          it('should leave an existing document untouched when a second create is rejected', async () => {
            await uec.connect({ providerType: CALCOM });
            await expect(callCreate()).rejects.toThrow();

            // a create that overwrote instead of failing would silently drop every existing connection
            expect(await uec.loadUserExternalConnection()).toBeDefined();
            expect((await uec.loadUserExternalConnection())?.c).toEqual([CALCOM]);
          });
        });

        describe('update:disconnect callable', () => {
          it('should disconnect the calling user from the provider', async () => {
            await uec.connect({ providerType: CALCOM });

            const params: DisconnectUserExternalConnectionParams = { providerType: CALCOM };
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(userExternalConnectionIdentity, params, 'disconnect'));

            const publicData = await uec.loadUserExternalConnection();
            const privateData = await uec.loadUserExternalConnectionPrivate();

            expect(Object.keys(publicData?.e ?? {})).not.toContain(CALCOM);
            expect(publicData?.c.length).toBe(0);
            expect(Object.keys(privateData?.cr ?? {})).not.toContain(CALCOM);
          });
        });

        describe('read:authorizeState callable', () => {
          it('should reject a user who has no connection document', async () => {
            // the connect role is asserted against the document, and a role map is only consulted for a
            // document that exists — so creating it is a precondition of connecting anything
            const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: CALCOM };
            await expect(u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))).rejects.toThrow();
          });

          describe('with a connection document', () => {
            beforeEach(async () => {
              await uec.createUserExternalConnection();
            });

            it('should mint a state that resolves back to the calling user', async () => {
              const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: CALCOM };
              const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

              expect(result.state).toBeDefined();
              // only the server can open it, so verify through the coder rather than by inspection
              expect(stateActorUid(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: CALCOM }))).toBe(u.uid);
            });

            it('should mint a state for every registered provider, not just the first', async () => {
              const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: DISCORD };
              const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

              expect(stateActorUid(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: DISCORD }))).toBe(u.uid);
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

            describe('admin-only provider', () => {
              function callAuthorizeState(params: ReadUserExternalConnectionAuthorizeStateParams) {
                return u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState')) as Promise<UserExternalConnectionAuthorizeStateResult>;
              }

              it('should refuse a non-admin a connect state for zoho_admin exactly as if it were not mounted', async () => {
                const adminOnlyCode = await errorCodeFor(() => callAuthorizeState({ providerType: ZOHO_ADMIN }));
                const unmountedCode = await errorCodeFor(() => callAuthorizeState({ providerType: ZOOM }));

                expect(adminOnlyCode).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
                // the same answer as an unmounted provider, so the call does not reveal that zoho_admin exists
                expect(adminOnlyCode).toBe(unmountedCode);
              });

              it('should refuse a non-admin a link state for zoho_admin', async () => {
                // one handler serves both modes, so the admin rule cannot be skipped by asking for a link
                expect(await errorCodeFor(() => callAuthorizeState({ providerType: ZOHO_ADMIN, mode: 'link' }))).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
              });

              it('should still mint a non-admin a state for the open zoho connection', async () => {
                const result = await callAuthorizeState({ providerType: ZOHO });

                // zoho declares no policy, so the admin-only zoho_admin connection beside it leaves it open
                expect(stateActorUid(f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: ZOHO }))).toBe(u.uid);
              });
            });
          });

          it('should offer exactly the providers whose oauth modules are mounted', () => {
            // the registry is built from the mounted services, so it cannot drift from the modules the
            // app actually imports the way a hand-maintained allowlist could
            const registry = f.nest.get(UserExternalConnectionOAuthProviderRegistry);

            expect(registry.hasAuthorizeFlowForProviderType(CALCOM)).toBe(true);
            expect(registry.hasAuthorizeFlowForProviderType(DISCORD)).toBe(true);
            expect(registry.hasAuthorizeFlowForProviderType(ZOHO)).toBe(true);
            // the second Zoho connection, registered under its own service token
            expect(registry.hasAuthorizeFlowForProviderType(ZOHO_ADMIN)).toBe(true);
            expect(registry.hasAuthorizeFlowForProviderType(ZOOM)).toBe(false);
          });
        });
      });
    });

    demoAuthorizedUserAdminContext({ f }, (au) => {
      demoUserExternalConnectionContext({ f, u: au, createIfNeeded: true }, () => {
        describe('read:authorizeState callable (admin)', () => {
          function callAuthorizeState(params: ReadUserExternalConnectionAuthorizeStateParams) {
            return au.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState')) as Promise<UserExternalConnectionAuthorizeStateResult>;
          }

          it('should mint an admin a connect state for zoho_admin, bound to that provider', async () => {
            const result = await callAuthorizeState({ providerType: ZOHO_ADMIN });
            const stateCoder = f.nest.get(UserExternalConnectionStateCoder);
            const actor = stateCoder.verifyState({ state: result.state, providerType: ZOHO_ADMIN });

            expect(stateActorUid(actor)).toBe(au.uid);
            expect(actor?.mode).toBe('connect');
            // a zoho_admin state cannot be redeemed at the plain zoho callback, nor the other way around
            expect(stateCoder.verifyState({ state: result.state, providerType: ZOHO })).toBeUndefined();
          });

          it('should mint an admin a link state for zoho_admin', async () => {
            const result = await callAuthorizeState({ providerType: ZOHO_ADMIN, mode: 'link' });
            const actor = f.nest.get(UserExternalConnectionStateCoder).verifyState({ state: result.state, providerType: ZOHO_ADMIN });

            expect(stateActorUid(actor)).toBe(au.uid);
            expect(actor?.mode).toBe('link');
          });

          it('should still refuse an admin a provider that is not mounted', async () => {
            expect(await errorCodeFor(() => callAuthorizeState({ providerType: ZOOM }))).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
          });
        });
      });
    });
  });
});
