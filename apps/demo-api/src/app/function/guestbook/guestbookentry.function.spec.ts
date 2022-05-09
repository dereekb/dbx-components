import { guestbookEntryUpdateEntry } from './guestbookentry.update';
import { UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
import { WrappedCloudFunction } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {

  describe('guestbookEntryUpdateEntry', () => {

    let guestbookEntryUpdateEntryCloudFn: WrappedCloudFunction<UpdateGuestbookEntryParams>;

    beforeEach(() => {
      const guestbookEntryUpdateEntryFn = guestbookEntryUpdateEntry(f.nestAppPromiseGetter);
      guestbookEntryUpdateEntryCloudFn = f.wrapCloudFunction(guestbookEntryUpdateEntryFn);
    });

    demoAuthorizedUserContext(f, (u) => {

      demoGuestbookContext({ f, active: true }, (g) => {
    
        describe('guestbook is active', () => {

          it('should create a guestbook entry if it does not exist.', async () => {

            const uid = u.uid;
            const entryCollection = f.instance.demoFirestoreCollections.guestbookEntryCollectionFactory(g.document);
            const userGuestbookEntry = entryCollection.documentAccessor().loadDocumentForPath(uid);

            let exists = await userGuestbookEntry.accessor.exists();
            expect(exists).toBe(false);

            const message = 'test message';
            const signed = 'test signed';

            const params: UpdateGuestbookEntryParams = {
              guestbook: g.documentId,
              message,
              signed
            };

            await u.callCloudFunction(guestbookEntryUpdateEntryCloudFn, params);

            exists = await userGuestbookEntry.accessor.exists();
            expect(exists).toBe(true);

            const data = await userGuestbookEntry.snapshotData();
            expect(data).toBeDefined();
            expect(data?.message).toBe(message);
            expect(data?.signed).toBe(signed);

          });

        });

        // todo: add other tests

      });

    });

  });

});
