import { demoUpdateModel } from '../model/crud.functions';
import { GuestbookEntry, guestbookEntryIdentity, UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { demoGuestbookEntryContext, DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
import { isDate, isValid } from 'date-fns';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('updateGuestbookEntry', { f, fn: demoUpdateModel }, (updateGuestbookEntryCloudFn) => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoGuestbookContext({ f, published: true }, (g) => {
        describe('guestbook is active', () => {
          it('should create a guestbook entry if it does not exist.', async () => {
            const uid = u.uid;
            const entryCollection = f.instance.demoFirestoreCollections.guestbookEntryCollectionFactory(g.document);
            const userGuestbookEntry = entryCollection.documentAccessor().loadDocumentForId(uid);

            let exists = await userGuestbookEntry.accessor.exists();
            expect(exists).toBe(false);

            const message = 'test message';
            const signed = 'test signed';

            const params: UpdateGuestbookEntryParams = {
              guestbook: g.documentId,
              message,
              signed
            };

            await u.callCloudFunction(updateGuestbookEntryCloudFn, {
              modelType: guestbookEntryIdentity.model,
              data: params
            });

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
                  message: newMessage,
                  published: true
                };

                await u.callCloudFunction(updateGuestbookEntryCloudFn, {
                  modelType: guestbookEntryIdentity.model,
                  data: params
                });

                exists = await userGuestbookEntry.accessor.exists();
                expect(exists).toBe(true);

                data = (await userGuestbookEntry.snapshotData())!;

                expect(data).toBeDefined();
                expect(data?.message).toBe(newMessage);
                expect(data?.signed).toBe(signed);
                expect(data?.published).toBe(true);
                expect(data?.createdAt).not.toBeFalsy();
                expect(data?.updatedAt).not.toBeFalsy();
                expect(isDate(data?.createdAt)).toBe(true);
                expect(isDate(data?.updatedAt)).toBe(true);
                expect(isValid(data?.createdAt)).toBe(true);
                expect(isValid(data?.updatedAt)).toBe(true);
              });
            });
          });
        });

        // todo: add other tests
      });
    });
  });
});
