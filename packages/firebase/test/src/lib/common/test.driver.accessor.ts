import { firstValueFrom } from 'rxjs';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Transaction, DocumentReference, WriteBatch, FirestoreDocumentAccessor, makeDocuments, FirestoreDocumentDataAccessor, FirestoreContext, FirestoreDocument, RunTransaction, LimitedFirestoreDocumentAccessor } from '@dereekb/firebase';
import { MockItemDocument, MockItem, MockItemPrivateDocument, MockItemPrivateFirestoreCollection, MockItemPrivate, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemFirestoreCollection, MockItemSubItemFirestoreCollectionGroup } from './firestore.mock.item';
import { MockItemCollectionFixture } from './firestore.mock.item.fixture';

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
            test: true,
            string: ''
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
          hasDataFromUpdate: (data) => data.test === false,
          loadDocumentForTransaction: (transaction, ref) => f.instance.firestoreCollection.documentAccessorForTransaction(transaction).loadDocument(ref!),
          loadDocumentForWriteBatch: (writeBatch, ref) => f.instance.firestoreCollection.documentAccessorForWriteBatch(writeBatch).loadDocument(ref!)
        }));
      });

      describe('Subcollections', () => {
        describe('singleItemFirestoreCollection (MockItemPrivate)', () => {
          let mockItemPrivateFirestoreCollection: MockItemPrivateFirestoreCollection;
          let itemPrivateDataDocument: MockItemPrivateDocument;
          let privateDataAccessor: FirestoreDocumentDataAccessor<MockItemPrivate>;
          let privateSub: SubscriptionObject;

          beforeEach(() => {
            mockItemPrivateFirestoreCollection = f.instance.collections.mockItemPrivateCollectionFactory(itemDocument);
            itemPrivateDataDocument = mockItemPrivateFirestoreCollection.loadDocument();
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

              await privateDataAccessor.set({ createdAt: new Date() });

              exists = await privateDataAccessor.exists();
              expect(exists).toBe(true);
            });
          });

          describe('with item', () => {
            beforeEach(async () => {
              await privateDataAccessor.set({ createdAt: new Date() });
            });

            describe('accessor', () => {
              const TEST_COMMENTS = 'test';

              describeAccessorTests<MockItemPrivate>(() => ({
                context: f.parent.context,
                accessor: privateDataAccessor,
                dataForUpdate: () => ({ comments: TEST_COMMENTS }),
                hasDataFromUpdate: (data) => data.comments === TEST_COMMENTS,
                loadDocumentForTransaction: (transaction, ref) => mockItemPrivateFirestoreCollection.loadDocumentForTransaction(transaction),
                loadDocumentForWriteBatch: (writeBatch, ref) => mockItemPrivateFirestoreCollection.loadDocumentForWriteBatch(writeBatch)
              }));
            });
          });
        });

        describe('MockItemSubItem', () => {
          let subItemDocument: MockItemSubItemDocument;

          beforeEach(async () => {
            subItemDocument = f.instance.collections.mockItemSubItemCollectionFactory(itemDocument).documentAccessor().newDocument();
            await subItemDocument.accessor.set({ value: 0 });
          });

          describe('firestoreCollectionWithParent (MockItemSubItem)', () => {
            let mockItemSubItemFirestoreCollection: MockItemSubItemFirestoreCollection;

            beforeEach(() => {
              mockItemSubItemFirestoreCollection = f.instance.collections.mockItemSubItemCollectionFactory(itemDocument);
            });

            describe('with item', () => {
              describe('accessor', () => {
                const TEST_VALUE = 1234;

                describeAccessorTests<MockItemSubItem>(() => ({
                  context: f.parent.context,
                  accessor: subItemDocument.accessor,
                  dataForUpdate: () => ({ value: TEST_VALUE }),
                  hasDataFromUpdate: (data) => data.value === TEST_VALUE,
                  loadDocumentForTransaction: (transaction, ref) => mockItemSubItemFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(ref!),
                  loadDocumentForWriteBatch: (writeBatch, ref) => mockItemSubItemFirestoreCollection.documentAccessorForWriteBatch(writeBatch).loadDocument(ref!)
                }));
              });
            });
          });

          describe('firestoreCollectionGroup (MockItemSubItem)', () => {
            let mockItemSubItemFirestoreCollectionGroup: MockItemSubItemFirestoreCollectionGroup;

            beforeEach(() => {
              mockItemSubItemFirestoreCollectionGroup = f.instance.collections.mockItemSubItemCollectionGroup;
            });

            describe('with item', () => {
              describe('accessor', () => {
                const TEST_VALUE = 1234;

                describeAccessorTests<MockItemSubItem>(() => ({
                  context: f.parent.context,
                  accessor: subItemDocument.accessor,
                  dataForUpdate: () => ({ value: TEST_VALUE }),
                  hasDataFromUpdate: (data) => data.value === TEST_VALUE,
                  loadDocumentForTransaction: (transaction, ref) => mockItemSubItemFirestoreCollectionGroup.documentAccessorForTransaction(transaction).loadDocument(ref!),
                  loadDocumentForWriteBatch: (writeBatch, ref) => mockItemSubItemFirestoreCollectionGroup.documentAccessorForWriteBatch(writeBatch).loadDocument(ref!)
                }));
              });
            });
          });
        });
      });
    });

    describe('documentAccessor()', () => {
      describe('loadDocumentForKey()', () => {
        it('should load an existing document from the path.', async () => {
          const document = firestoreDocumentAccessor.loadDocumentForKey(items[0].documentRef.path);
          const exists = await document.accessor.exists();

          expect(exists).toBe(true);
        });

        it('should throw an exception if the path is invalid (points to collection)', () => {
          try {
            firestoreDocumentAccessor.loadDocumentForKey('path');
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
        });

        it('should throw an exception if the path is empty.', () => {
          try {
            firestoreDocumentAccessor.loadDocumentForKey('');
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
        });

        it('should throw an exception if the path is undefined.', () => {
          try {
            firestoreDocumentAccessor.loadDocumentForKey(undefined as any);
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
        });
      });

      describe('loadDocumentForPath()', () => {
        it('should return a document at the given path.', () => {
          const document = firestoreDocumentAccessor.loadDocumentForPath('path');
          expect(document).toBeDefined();
        });

        it('should throw an exception if the path is empty.', () => {
          try {
            firestoreDocumentAccessor.loadDocumentForPath('');
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
        });

        it('should throw an exception if the path is undefined.', () => {
          try {
            firestoreDocumentAccessor.loadDocumentForPath(undefined as any);
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
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
      let runTransaction: RunTransaction;

      beforeEach(() => {
        runTransaction = c.context.runTransaction;
      });

      it('should return the first emitted value (observable completes immediately)', async () => {
        await runTransaction(async (transaction) => {
          const transactionItemDocument = c.loadDocumentForTransaction(transaction, c.accessor.documentRef);

          // load the value
          const value = await firstValueFrom(transactionItemDocument.accessor.stream());

          expect(value).toBeDefined();

          // set to make the transaction valid
          await transactionItemDocument.accessor.set({ value: 0 } as any, { merge: true });

          return value;
        });
      });
    });

    describe('in batch context', () => {
      it('should return the first emitted value (observable completes immediately)', async () => {
        let writeBatch: WriteBatch = c.context.batch();
        const batchItemDocument = c.loadDocumentForWriteBatch(writeBatch, c.accessor.documentRef);

        // load the value
        const value = await firstValueFrom(batchItemDocument.accessor.stream());

        expect(value).toBeDefined();

        // set to make the batch changes valid
        await batchItemDocument.accessor.set({ value: 0 } as any, { merge: true });

        // commit the changes
        await writeBatch.commit();
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

    // todo: test that update does not call the converter when setting values.
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

    // todo: test that set calls the converter when setting values.
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
