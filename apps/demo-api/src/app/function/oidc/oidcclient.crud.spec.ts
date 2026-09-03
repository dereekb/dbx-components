import { demoCallModel } from './../model/crud.functions';
import {
  type CreateOidcClientParams,
  type CreateOidcClientResult,
  type RotateOidcClientSecretResult,
  oidcEntryIdentity,
  type UpdateOidcClientParams,
  type DeleteOidcClientParams,
  type OidcEntryClientId,
  type OidcEntryOAuthClientPayloadData,
  firestoreModelKey,
  onCallCreateModelParams,
  onCallUpdateModelParams,
  onCallDeleteModelParams
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { profileIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('oidcClient', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    async function loadClientProfiles(clientId: OidcEntryClientId): Promise<Maybe<string[]>> {
      const accessor = f.instance.demoFirestoreCollections.oidcEntryCollection.documentAccessor();
      const document = accessor.loadDocumentForId(clientId);
      const data = await document.snapshotData();
      return (data?.payload as OidcEntryOAuthClientPayloadData | undefined)?.dbx_provider_profiles ?? undefined;
    }

    demoAuthorizedUserContext({ f }, (u) => {
      const testCreateParams: CreateOidcClientParams = {
        client_name: 'Test Client',
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_post'
      };

      async function createTestClient(): Promise<CreateOidcClientResult> {
        return (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(oidcEntryIdentity, testCreateParams, 'client'))) as CreateOidcClientResult;
      }

      describe('create', () => {
        it('should create an oidc client.', async () => {
          const result = await createTestClient();

          expect(result).toBeDefined();
          expect(result.modelKeys).toBeDefined();
          expect(result.client_id).toBeDefined();
          expect(result.client_secret).toBeDefined();
        });

        it('should set the ownership key on the created OidcEntry.', async () => {
          const result = await createTestClient();
          const expectedOwnerKey = firestoreModelKey(profileIdentity, u.uid);

          const accessor = f.instance.demoFirestoreCollections.oidcEntryCollection.documentAccessor();
          const document = accessor.loadDocumentForId(result.client_id);
          const data = await document.snapshotData();

          expect(data).toBeDefined();
          expect(data?.o).toBe(expectedOwnerKey);
        });
      });

      describe('update', () => {
        it('should update an oidc client.', async () => {
          const createResult = await createTestClient();

          const updateParams: UpdateOidcClientParams = {
            key: createResult.modelKeys as string,
            client_name: 'Updated Client',
            redirect_uris: ['https://example.com/updated-callback']
          };

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, updateParams, 'client'));

          const accessor = f.instance.demoFirestoreCollections.oidcEntryCollection.documentAccessor();
          const document = accessor.loadDocumentForId(createResult.client_id);
          const data = await document.snapshotData();

          expect(data).toBeDefined();
          expect(data?.type).toBe('Client');
        });

        describe('provider profiles', () => {
          it('should ignore dbx_provider_profiles on a non-admin update (existing assignment preserved).', async () => {
            const createResult = await createTestClient();

            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys as string, client_name: 'Updated Client', redirect_uris: ['https://example.com/callback'], dbx_provider_profiles: ['lms'] }, 'client'));

            const profiles = await loadClientProfiles(createResult.client_id);
            expect(profiles ?? []).toEqual([]);
          });

          demoAuthorizedUserAdminContext({ f }, (admin) => {
            const adminBaseParams = { client_name: 'Admin Client', redirect_uris: ['https://example.com/callback'] };

            async function createAdminClient(): Promise<CreateOidcClientResult> {
              return (await admin.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(oidcEntryIdentity, { ...adminBaseParams, token_endpoint_auth_method: 'client_secret_post' }, 'client'))) as CreateOidcClientResult;
            }

            it('should set dbx_provider_profiles on an admin update.', async () => {
              const createResult = await createAdminClient();

              await admin.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys as string, ...adminBaseParams, dbx_provider_profiles: ['lms', 'reports'] }, 'client'));

              const profiles = await loadClientProfiles(createResult.client_id);
              expect(profiles).toEqual(['lms', 'reports']);
            });

            it('should reject an admin update with an unknown provider profile key (and persist nothing).', async () => {
              const createResult = await createAdminClient();

              await expect(admin.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys as string, ...adminBaseParams, dbx_provider_profiles: ['not-a-real-profile'] }, 'client'))).rejects.toThrow();

              const profiles = await loadClientProfiles(createResult.client_id);
              expect(profiles ?? []).toEqual([]);
            });
          });
        });
      });

      describe('delete', () => {
        it('should delete an oidc client.', async () => {
          const createResult = await createTestClient();

          const deleteParams: DeleteOidcClientParams = {
            key: createResult.modelKeys as string
          };

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(oidcEntryIdentity, deleteParams, 'client'));

          const accessor = f.instance.demoFirestoreCollections.oidcEntryCollection.documentAccessor();
          const document = accessor.loadDocumentForId(createResult.client_id);
          const exists = await document.accessor.exists();

          expect(exists).toBe(false);
        });
      });

      describe('rotateClientSecret', () => {
        it('should rotate the client secret and return a new secret', async () => {
          const createResult = await createTestClient();

          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys }, 'rotateClientSecret'))) as RotateOidcClientSecretResult;

          expect(result).toBeDefined();
          expect(result.client_id).toBeDefined();
          expect(result.client_secret).toBeDefined();
          expect(result.client_id).toBe(createResult.client_id);
        });

        it('should produce a different secret each time', async () => {
          const createResult = await createTestClient();

          const result1 = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys }, 'rotateClientSecret'))) as RotateOidcClientSecretResult;
          const result2 = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys }, 'rotateClientSecret'))) as RotateOidcClientSecretResult;

          expect(result1.client_secret).toBeDefined();
          expect(result2.client_secret).toBeDefined();
          expect(result1.client_secret).not.toBe(result2.client_secret);
        });
      });

      describe('provider profiles', () => {
        it('should strip dbx_provider_profiles from a non-admin create (the assignment is ignored).', async () => {
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(oidcEntryIdentity, { ...testCreateParams, dbx_provider_profiles: ['lms'] }, 'client'))) as CreateOidcClientResult;
          const profiles = await loadClientProfiles(result.client_id);
          expect(profiles ?? []).toEqual([]);
        });
      });
    });

    demoAuthorizedUserAdminContext({ f }, (admin) => {
      const adminCreateParams: CreateOidcClientParams = {
        client_name: 'Admin Client',
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_post'
      };

      async function createAdminClientWithProfiles(profiles: string[]): Promise<CreateOidcClientResult> {
        return (await admin.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(oidcEntryIdentity, { ...adminCreateParams, dbx_provider_profiles: profiles }, 'client'))) as CreateOidcClientResult;
      }

      describe('provider profiles', () => {
        it('should persist dbx_provider_profiles on an admin create.', async () => {
          const result = await createAdminClientWithProfiles(['lms']);
          const profiles = await loadClientProfiles(result.client_id);
          expect(profiles).toEqual(['lms']);
        });

        it('should preserve the existing assignment when an admin update omits the field.', async () => {
          const createResult = await createAdminClientWithProfiles(['lms']);

          await admin.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, { key: createResult.modelKeys as string, client_name: 'Renamed', redirect_uris: ['https://example.com/callback'] }, 'client'));

          const profiles = await loadClientProfiles(createResult.client_id);
          expect(profiles).toEqual(['lms']);
        });
      });
    });
  });
});
