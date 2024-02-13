import { demoCallModel } from './../model/crud.functions';
import { CreateGuestbookParams, guestbookIdentity } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('createGuestbook', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should create a guestbook.', async () => {
        const name = 'testName';

        const params: CreateGuestbookParams = {
          name
        };

        const result: OnCallCreateModelResult = await u.callCloudFunction(demoCallModelCloudFn, onCallCreateModelParams(guestbookIdentity, params));

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
