import { SubscriptionObject } from '@dereekb/rxjs';
import { FirestoreDocumentDataAccessor } from "../../lib/common/firestore/accessor/accessor";
import { FirestoreDocument, FirestoreDocumentAccessor } from "../../lib/common/firestore/accessor/document";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { FirestoreContext } from '../../lib/common/firestore/context';
import { RunTransactionFunction } from '../../lib/common/firestore/factory';
import { DocumentReference, Transaction, WriteBatch } from '../../lib/common/firestore/types';
import { MockItemDocument, MockItem, MockItemPrivateDataDocument, MockItemPrivateDataFirestoreCollection, MockItemPrivateData, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemFirestoreCollection } from "./firestore.mock.item";
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

    describe('MockItem', () => {

      let itemDocument: MockItemDocument;
      let accessor: FirestoreDocumentDataAccessor<MockItem>;

      beforeEach(() => {
        itemDocument = items[0];
        accessor = itemDocument.accessor;
      });

      describe('accessor', () => {
        describeAccessorTests<MockItem>(() => ({
          context: f.parent.context,
          accessor,
          dataForUpdate: () => ({ test: false }),
          hasDataFromUpdate: (data) => (data.test === false),
          loadDocumentForTransaction: (transaction, ref) => f.instance.firestoreCollection.documentAccessorForTransaction(transaction).loadDocument(ref!),
          loadDocumentForWriteBatch: (writeBatch, ref) => f.instance.firestoreCollection.documentAccessorForWriteBatch(writeBatch).loadDocument(ref!),
        }));
      });

      describe('Subcollections', () => {

        describe('singleItemFirestoreCollection (MockItemPrivateData)', () => {

          let mockItemPrivateDataFirestoreCollection: MockItemPrivateDataFirestoreCollection;
          let itemPrivateDataDocument: MockItemPrivateDataDocument;
          let privateDataAccessor: FirestoreDocumentDataAccessor<MockItemPrivateData>;
          let privateSub: SubscriptionObject;

          beforeEach(() => {
            mockItemPrivateDataFirestoreCollection = f.instance.collections.mockItemPrivateData(itemDocument);
            itemPrivateDataDocument = mockItemPrivateDataFirestoreCollection.loadDocument();
            privateDataAccessor = itemPrivateDataDocument.accessor;
            privateSub = new SubscriptionObject();
          });

          afterEach(() => {
            privateSub.destroy();
          });

          describe('set()', () => {

            it('should create the item', async () => {
              let exists = await privateDataAccessor.exists();
              expect(exists).toBe(false);

              await privateDataAccessor.set({});

              exists = await privateDataAccessor.exists();
              expect(exists).toBe(true);
            });

          });

          describe('with item', () => {

            beforeEach(async () => {
              await privateDataAccessor.set({});
            });

            describe('accessor', () => {
              const TEST_COMMENTS = 'test';

              describeAccessorTests<MockItemPrivateData>(() => ({
                context: f.parent.context,
                accessor: privateDataAccessor,
                dataForUpdate: () => ({ comments: TEST_COMMENTS }),
                hasDataFromUpdate: (data) => (data.comments === TEST_COMMENTS),
                loadDocumentForTransaction: (transaction, ref) => mockItemPrivateDataFirestoreCollection.loadDocumentForTransaction(transaction),
                loadDocumentForWriteBatch: (writeBatch, ref) => mockItemPrivateDataFirestoreCollection.loadDocumentForWriteBatch(writeBatch),
              }));
            });

          });

        });

        describe('singleItemFirestoreCollection (MockItemSubItem)', () => {

          let mockItemSubItemFirestoreCollection: MockItemSubItemFirestoreCollection;
          let subItemAccessor: FirestoreDocumentAccessor<MockItemSubItem, MockItemSubItemDocument>;

          beforeEach(() => {
            mockItemSubItemFirestoreCollection = f.instance.collections.mockItemSubItem(itemDocument);
            subItemAccessor = mockItemSubItemFirestoreCollection.documentAccessor();
          });

          describe('with item', () => {

            let subItemDocument: MockItemSubItemDocument;

            beforeEach(async () => {
              subItemDocument = subItemAccessor.newDocument();
              await subItemDocument.accessor.set({ value: 0 });
            });

            describe('accessor', () => {
              const TEST_VALUE = 1234;

              describeAccessorTests<MockItemSubItem>(() => ({
                context: f.parent.context,
                accessor: subItemDocument.accessor,
                dataForUpdate: () => ({ value: TEST_VALUE }),
                hasDataFromUpdate: (data) => (data.value === TEST_VALUE),
                loadDocumentForTransaction: (transaction, ref) => mockItemSubItemFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(ref!),
                loadDocumentForWriteBatch: (writeBatch, ref) => mockItemSubItemFirestoreCollection.documentAccessorForWriteBatch(writeBatch).loadDocument(ref!),
              }));
            });

          });

        });

      });

    });

  });

}


export interface DescribeAccessorTests<T> {
  context: FirestoreContext;
  accessor: FirestoreDocumentDataAccessor<any>;
  dataForUpdate: () => Partial<T>;
  hasDataFromUpdate: (data: T) => boolean;
  loadDocumentForTransaction: (transaction: Transaction, ref?: DocumentReference<T>) => FirestoreDocument<T>;
  loadDocumentForWriteBatch: (writeBatch: WriteBatch, ref?: DocumentReference<T>) => FirestoreDocument<T>;
}

export function describeAccessorTests<T>(init: () => DescribeAccessorTests<T>) {

  let c: DescribeAccessorTests<T>;
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
    c = init();
  });

  afterEach(() => {
    sub.destroy();
  });

  describe('stream()', () => {

    it('should return a snapshot stream', async () => {
      const result = await c.accessor.stream();
      expect(result).toBeDefined();
    });

    it('should emit values on updates from the observable.', (done) => {
      let count = 0;

      sub.subscription = c.accessor.stream().subscribe((item) => {
        count += 1;

        if (count === 1) {
          expect(c.hasDataFromUpdate(item.data())).toBe(false);
        } else if (count === 2) {
          expect(c.hasDataFromUpdate(item.data())).toBe(true);
          done();
        }
      });

      setTimeout(() => {
        c.accessor.update(c.dataForUpdate());
      }, 100);
    });

    describe('in transition context', () => {

      let runTransaction: RunTransactionFunction;

      beforeEach(() => {
        runTransaction = c.context.runTransaction;
      });

      it('should not stream values (observable completes immediately)', (done) => {
        runTransaction((transaction) => {
          const transactionItemDocument = c.loadDocumentForTransaction(transaction, c.accessor.documentRef);
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

      it('should not stream values (observable completes immediately)', (done) => {
        let writeBatch: WriteBatch = c.context.batch();
        const batchItemDocument = c.loadDocumentForWriteBatch(writeBatch, c.accessor.documentRef);

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
      const result = await c.accessor.get();
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

  });

  describe('exists()', () => {

    it('should return true if the document exists', async () => {
      const exists = await c.accessor.exists();
      expect(exists).toBe(true);
    });

    it('should return false if the document does not exist', async () => {
      await c.accessor.delete();
      const exists = await c.accessor.exists();
      expect(exists).toBe(false);
    });

  });

  describe('update()', () => {

    it('should update the data if the document exists.', async () => {
      const data = c.dataForUpdate();
      await c.accessor.update(data);

      const snapshot = await c.accessor.get();
      expect(c.hasDataFromUpdate(snapshot.data())).toBe(true);
    });

    it('should fail if the document does not exist.', async () => {
      await c.accessor.delete();

      const snapshot = await c.accessor.get();
      expect(snapshot.data()).toBe(undefined);

      const exists = await c.accessor.exists();
      expect(exists).toBe(false);

      try {
        await c.accessor.update(c.dataForUpdate());
        fail();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

  });

  describe('set()', () => {

    it('should create the object if it does not exist.', async () => {
      await c.accessor.delete();

      let exists = await c.accessor.exists();
      expect(exists).toBe(false);

      const data = c.dataForUpdate();
      await c.accessor.set(data);

      exists = await c.accessor.exists();
      expect(exists).toBe(true);

      const snapshot = await c.accessor.get();
      expect(c.hasDataFromUpdate(snapshot.data())).toBe(true);
    });

    it('should update the data on the document for fields that are not undefined.', async () => {
      const data = c.dataForUpdate();
      await c.accessor.set(data);
      const snapshot = await c.accessor.get();
      expect(c.hasDataFromUpdate(snapshot.data())).toBe(true);
    });

  });

  describe('delete()', () => {

    it('should delete the document.', async () => {
      await c.accessor.delete();

      const snapshot = await c.accessor.get();
      expect(snapshot.data()).toBe(undefined);

      const exists = await c.accessor.exists();
      expect(exists).toBe(false);
    });

  });

}
