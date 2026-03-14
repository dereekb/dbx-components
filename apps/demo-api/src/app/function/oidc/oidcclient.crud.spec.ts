import { demoCallModel } from './../model/crud.functions';
import { type CreateOidcClientParams, type CreateOidcClientResult, type RotateOidcClientSecretResult, oidcEntryIdentity, type UpdateOidcClientParams, type DeleteOidcClientParams, firestoreModelKey, onCallCreateModelParams, onCallUpdateModelParams, onCallDeleteModelParams } from '@dereekb/firebase';
import { profileIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('oidcClient', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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
    });
  });
});
