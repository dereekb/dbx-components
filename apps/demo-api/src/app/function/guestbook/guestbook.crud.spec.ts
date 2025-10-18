import { demoCallModel } from './../model/crud.functions';
import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('createGuestbook', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should create a guestbook.', async () => {
        const name = 'testName';

        const params: CreateGuestbookParams = {
          name
        };

        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;

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
