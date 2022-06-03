import { demoCreateModel } from './../model/crud.functions';
import { CreateGuestbookParams, guestbookIdentity } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { OnCallCreateModelResult } from '@dereekb/firebase';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('createGuestbook', { f, fn: demoCreateModel }, (createGuestbookCloudFn) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should create a guestbook.', async () => {
        const name = 'guestbook';

        const params: CreateGuestbookParams = {
          name
        };

        const result: OnCallCreateModelResult = await u.callCloudFunction(createGuestbookCloudFn, {
          modelType: guestbookIdentity.model,
          data: params
        });

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();

        const createdModelKey = result.modelKeys[0];
        expect(createdModelKey).toBeDefined();

        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(createdModelKey);

        const exists = await document.accessor.exists();
        expect(exists).toBe(true);

        const data = await document.snapshotData();
        expect(data).toBeDefined();
        expect(data?.name).toBe(name);
      });
    });
  });
});
