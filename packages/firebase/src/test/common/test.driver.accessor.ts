import { SubscriptionObject } from '@dereekb/rxjs';
import { FirestoreDocumentDataAccessor } from "../../lib/common/firestore/accessor/accessor";
import { FirestoreDocumentAccessor } from "../../lib/common/firestore/accessor/document";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { RunTransactionFunction } from '../../lib/common/firestore/factory';
import { WriteBatch } from '../../lib/common/firestore/types';
import { MockItemDocument, MockItem } from "./firestore.mock.item";
import { MockItemCollectionFixture } from "./firestore.mock.item.fixture";

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 * 
 * @param f 
 */
export function describeAccessorDriverTests(f: MockItemCollectionFixture) {

  describe('FirestoreAccessorDriver', () => {

    const testDocumentCount = 5;

    let firestoreDocumentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;
    let items: MockItemDocument[];

    beforeEach(async () => {
      firestoreDocumentAccessor = f.instance.firestoreCollection.documentAccessor();
      items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
        count: testDocumentCount,
        init: (i) => {
          return {
            value: `${i}`,
            test: true
          };
        }
      });
    });

    describe('item', () => {

      let itemDocument: MockItemDocument;
      let accessor: FirestoreDocumentDataAccessor<MockItem>;
      let sub: SubscriptionObject;

      beforeEach(() => {
        itemDocument = items[0];
        accessor = itemDocument.accessor;
        sub = new SubscriptionObject();
      });

      afterEach(() => {
        sub.destroy();
      });

      describe('accessor', () => {

        describe('stream()', () => {

          it('should return a snapshot stream', async () => {
            const result = await accessor.stream();
            expect(result).toBeDefined();
          });

          it('should emit values on updates from the observable.', (done) => {
            let count = 0;

            sub.subscription = accessor.stream().subscribe((item) => {
              count += 1;

              if (count === 1) {
                expect(item.data()?.test).toBe(true);
              } else if (count === 2) {
                expect(item.data()?.test).toBe(false);
                done();
              }
            });

            setTimeout(() => {
              accessor.update({
                test: false
              });
            }, 100);
          });

          describe('in transition context', () => {

            let runTransaction: RunTransactionFunction;

            beforeEach(() => {
              runTransaction = f.parent.context.runTransaction;
            });

            it('should not stream values (observable completes immediately)', (done) => {
              runTransaction((transaction) => {
                const accessorInContext = f.instance.firestoreCollection.documentAccessorForTransaction(transaction);
                const transactionItemDocument = accessorInContext.loadDocument(itemDocument.documentRef);

                sub.subscription = transactionItemDocument.accessor.stream().subscribe({
                  complete: () => {
                    done();
                  }
                });

                return Promise.resolve();
              });
            });

          });

          describe('in batch context', () => {
            let writeBatch: WriteBatch;

            beforeEach(() => {
              writeBatch = f.parent.context.batch();
            });

            it('should not stream values (observable completes immediately)', (done) => {
              const accessorInContext = f.instance.firestoreCollection.documentAccessorForWriteBatch(writeBatch);
              const batchItemDocument = accessorInContext.loadDocument(itemDocument.documentRef);

              sub.subscription = batchItemDocument.accessor.stream().subscribe({
                complete: () => {
                  done();
                }
              });
            });

          });

        });

        describe('get()', () => {

          it('should return a snapshot', async () => {
            const result = await accessor.get();
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
          });

        });

        describe('exists()', () => {

          it('should return true if the document exists', async () => {
            const exists = await accessor.exists();
            expect(exists).toBe(true);
          });

          it('should return false if the document does not exist', async () => {
            await accessor.delete();
            const exists = await accessor.exists();
            expect(exists).toBe(false);
          });

        });

        describe('update()', () => {

          it('should update the data if the document exists.', async () => {
            const testValue = false;
            await accessor.update({ test: testValue });

            const snapshot = await accessor.get();
            expect(snapshot.data()?.test).toBe(testValue);
          });

          it('should fail if the document does not exist.', async () => {
            await accessor.delete();

            const snapshot = await accessor.get();
            expect(snapshot.data()).toBe(undefined);

            const exists = await accessor.exists();
            expect(exists).toBe(false);

            try {
              await accessor.update({ test: false });
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
          });

        });

        describe('set()', () => {

          it('should update the data on the document for fields that are not undefined.', async () => {
            const newValue = 'x';

            await accessor.set({
              value: newValue,
              test: undefined
            });

            const snapshot = await accessor.get();
            expect(snapshot.data()?.value).toBe(newValue);
            expect(snapshot.data()?.test).toBe(false);
          });

        });

        describe('delete()', () => {

          it('should delete the document.', async () => {
            await accessor.delete();

            const snapshot = await accessor.get();
            expect(snapshot.data()).toBe(undefined);

            const exists = await accessor.exists();
            expect(exists).toBe(false);
          });

        });

      });

    });

  });

}
