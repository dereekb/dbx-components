import { type GuestbookEntry, guestbookEntryIdentity, type InsertGuestbookEntryParams } from 'demo-firebase';
import { demoGuestbookEntryContext, type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
import { isDate, isValid } from 'date-fns';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { onCallUpdateModelParams } from '@dereekb/firebase';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('insertGuestbookEntry', { f, fn: demoCallModel }, (callGuestbookEntryWrappedFn) => {
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

            const params: InsertGuestbookEntryParams = {
              guestbook: g.documentId,
              message,
              signed
            };

            await u.callWrappedFunction(callGuestbookEntryWrappedFn, onCallUpdateModelParams(guestbookEntryIdentity, params));

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
              describe('reading a guestbook entry', () => {
                describe('with incomplete database data', () => {
                  beforeEach(async () => {
                    // clear the data from the entry
                    await ge.document.accessor.update({ updatedAt: null, createdAt: null } as any);
                  });

                  it('should read default times', async () => {
                    const rawData = (await ge.document.accessor.getWithConverter(null)).data();

                    expect(rawData?.updatedAt).toBeNull();
                    expect(rawData?.createdAt).toBeNull();

                    const data = await ge.document.snapshotData();

                    expect(data?.updatedAt).toBeDefined();
                    expect(data?.createdAt).toBeDefined();
                    expect(isDate(data?.updatedAt)).toBe(true);
                    expect(isDate(data?.createdAt)).toBe(true);
                  });
                });
              });

              it('should update guestbook entry.', async () => {
                const userGuestbookEntry = ge.document;

                let exists = await userGuestbookEntry.accessor.exists();
                expect(exists).toBe(true);

                let data: GuestbookEntry = (await userGuestbookEntry.snapshotData())!;
                expect(data).toBeDefined();

                const message = data.message;
                const signed = data.signed;

                const newMessage = 'updated test message';

                const params: InsertGuestbookEntryParams = {
                  guestbook: g.documentId,
                  message: newMessage,
                  published: true
                };

                await u.callWrappedFunction(callGuestbookEntryWrappedFn, onCallUpdateModelParams(guestbookEntryIdentity, params));

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
