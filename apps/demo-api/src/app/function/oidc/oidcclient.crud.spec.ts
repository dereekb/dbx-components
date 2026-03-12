import { demoCallModel } from './../model/crud.functions';
import { type CreateOidcClientParams, type CreateOidcClientResult, oidcEntryIdentity, type UpdateOidcClientParams, type DeleteOidcClientParams, firestoreModelKey } from '@dereekb/firebase';
import { profileIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { onCallCreateModelParams, onCallUpdateModelParams, onCallDeleteModelParams } from '@dereekb/firebase';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('oidcClient', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      const testCreateParams: CreateOidcClientParams = {
        client_name: 'Test Client',
        redirect_uris: ['https://example.com/callback']
      };

      async function createTestClient(): Promise<CreateOidcClientResult> {
        return (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(oidcEntryIdentity, testCreateParams))) as CreateOidcClientResult;
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

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(oidcEntryIdentity, updateParams));

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

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(oidcEntryIdentity, deleteParams));

          const accessor = f.instance.demoFirestoreCollections.oidcEntryCollection.documentAccessor();
          const document = accessor.loadDocumentForId(createResult.client_id);
          const exists = await document.accessor.exists();

          expect(exists).toBe(false);
        });
      });
    });
  });
});
