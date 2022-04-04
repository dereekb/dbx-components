import { SubscriptionObject } from '@dereekb/rxjs';
import { FirestoreDocumentDataAccessor } from "../../lib/common/firestore/accessor/accessor";
import { FirestoreDocumentAccessor } from "../../lib/common/firestore/accessor/document";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { RunTransactionFunction } from '../../lib/common/firestore/factory';
import { FirestoreCollectionQueryFactoryFunction } from "../../lib/common/firestore/query/query";
import { Transaction, WriteBatch } from '../../lib/common/firestore/types';
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

    let query: FirestoreCollectionQueryFactoryFunction<MockItem>;
    let firestoreDocumentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;
    let items: MockItemDocument[];

    beforeEach(async () => {
      query = f.instance.firestoreCollection.query;
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
              runTransaction = f.parent.context.transaction();
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
              writeBatch = f.parent.context.writeBatch() as WriteBatch;
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

        describe('update()', () => {

          it('should update the data.', async () => {
            const testValue = false;
            await accessor.update({ test: testValue });

            const snapshot = await accessor.get();
            expect(snapshot.data()?.test).toBe(testValue);
          });

        });

      });

    });

  });

}
