import { guestbookEntryUpdateEntry } from './guestbookentry.update';
import { GuestbookEntry, UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { demoGuestbookEntryContext, DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
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
            expect(data?.createdAt).not.toBeFalsy();
            expect(data?.updatedAt).not.toBeFalsy();
          });

          describe('guestbook entry exists', () => {

            demoGuestbookEntryContext({ f, u, g }, (ge) => {

              it('should update guestbook entry.', async () => {

                const userGuestbookEntry = ge.document;

                let exists = await userGuestbookEntry.accessor.exists();
                expect(exists).toBe(true);

                let data: GuestbookEntry = (await userGuestbookEntry.snapshotData())!;
                expect(data).toBeDefined();

                const message = data.message;
                const signed = data.signed;

                const newMessage = 'updated test message';

                const params: UpdateGuestbookEntryParams = {
                  guestbook: g.documentId,
                  message: newMessage
                };

                await u.callCloudFunction(guestbookEntryUpdateEntryCloudFn, params);

                exists = await userGuestbookEntry.accessor.exists();
                expect(exists).toBe(true);

                data = (await userGuestbookEntry.snapshotData())!;
                expect(data).toBeDefined();
                expect(data?.message).toBe(newMessage);
                expect(data?.signed).toBe(signed);
                expect(data?.createdAt).not.toBeFalsy();
                expect(data?.updatedAt).not.toBeFalsy();
              });

            });

          });

        });

        // todo: add other tests

      });

    });

  });

});
