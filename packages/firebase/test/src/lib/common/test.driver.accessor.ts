import { itShouldFail, expectFail } from '@dereekb/util/test';
import { firstValueFrom } from 'rxjs';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Transaction, DocumentReference, WriteBatch, FirestoreDocumentAccessor, makeDocuments, FirestoreDocumentDataAccessor, FirestoreContext, FirestoreDocument, RunTransaction, FirebaseAuthUserId, DocumentSnapshot, FirestoreDataConverter } from '@dereekb/firebase';
import { MockItemDocument, MockItem, MockItemPrivateDocument, MockItemPrivateFirestoreCollection, MockItemPrivate, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemFirestoreCollection, MockItemSubItemFirestoreCollectionGroup, MockItemUserFirestoreCollection, MockItemUserDocument, MockItemUser, mockItemConverter } from './firestore.mock.item';
import { MockItemCollectionFixture } from './firestore.mock.item.fixture';

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeAccessorDriverTests(f: MockItemCollectionFixture) {
  describe('FirestoreAccessorDriver', () => {
    const testDocumentCount = 5;

    let mockItemFirestoreDocumentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;
    let items: MockItemDocument[];

    beforeEach(async () => {
      mockItemFirestoreDocumentAccessor = f.instance.firestoreCollection.documentAccessor();
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
        describe('singleItemFirestoreCollection (MockItemUser)', () => {
          let testUserId: FirebaseAuthUserId;
          let mockItemUserFirestoreCollection: MockItemUserFirestoreCollection;
          let itemUserDataDocument: MockItemUserDocument;
          let userDataAccessor: FirestoreDocumentDataAccessor<MockItemUser>;

          beforeEach(() => {
            testUserId = 'userid' + Math.ceil(Math.random() * 100000);
            mockItemUserFirestoreCollection = f.instance.collections.mockItemUserCollectionFactory(itemDocument);
            itemUserDataDocument = mockItemUserFirestoreCollection.documentAccessor().loadDocumentForId(testUserId);
            userDataAccessor = itemUserDataDocument.accessor;
          });

          describe('set()', () => {
            describe('mockItemUserAccessorFactory usage', () => {
              it('should copy the documents identifier to the uid field on set.', async () => {
                await itemUserDataDocument.accessor.set({
                  uid: '', // the mockItemUserAccessorFactory silently enforces the uid to be the same as the document.
                  name: 'hello'
                });

                const snapshot = await itemUserDataDocument.accessor.get();
                expect(snapshot.data()?.uid).toBe(testUserId);
              });
            });
          });
        });

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

          describe('get()', () => {
            it('should read that data using the configured converter', async () => {
              await itemPrivateDataDocument.accessor.set({ values: null } as any);
              const dataWithoutConverter: any = (await itemPrivateDataDocument.accessor.getWithConverter(null)).data();

              expect(dataWithoutConverter).toBeDefined();
              expect(dataWithoutConverter.values).toBeNull();

              // converter on client, _converter on server
              expect((itemPrivateDataDocument.documentRef as any).converter ?? (itemPrivateDataDocument.documentRef as any)._converter).toBeDefined();

              const data = await itemPrivateDataDocument.snapshotData();
              expect(data?.values).toBeDefined();
              expect(data?.values).not.toBeNull(); // should not be null due to the snapshot converter config
            });
          });

          describe('getWithConverter()', () => {
            it('should get the results with the input converter', async () => {
              await itemPrivateDataDocument.accessor.set({ values: null } as any);

              const data = await itemPrivateDataDocument.snapshotData();
              expect(data?.values).toBeDefined();

              const dataWithoutConverter: any = (await itemPrivateDataDocument.accessor.getWithConverter(null)).data();

              expect(dataWithoutConverter).toBeDefined();
              expect(dataWithoutConverter.values).toBeNull();
            });

            it('should get the results with the input converter with a type', async () => {
              await itemPrivateDataDocument.accessor.set({ values: null } as any);

              const data = await itemPrivateDataDocument.snapshotData();
              expect(data?.values).toBeDefined();

              const converter: FirestoreDataConverter<MockItem> = mockItemConverter;
              const dataWithoutConverter: DocumentSnapshot<MockItem> = await itemPrivateDataDocument.accessor.getWithConverter(converter);

              expect(dataWithoutConverter).toBeDefined();
            });
          });

          describe('createOrUpdate()', () => {
            it('should create the item if it does not exist', async () => {
              let exists = await itemPrivateDataDocument.accessor.exists();
              expect(exists).toBe(false);

              await itemPrivateDataDocument.createOrUpdate({ createdAt: new Date() });

              exists = await privateDataAccessor.exists();
              expect(exists).toBe(true);
            });
          });

          describe('set()', () => {
            it('should create the item', async () => {
              let exists = await privateDataAccessor.exists();
              expect(exists).toBe(false);

              await privateDataAccessor.set({ values: [], createdAt: new Date() });

              exists = await privateDataAccessor.exists();
              expect(exists).toBe(true);
            });
          });

          describe('with item', () => {
            beforeEach(async () => {
              await privateDataAccessor.set({ values: [], createdAt: new Date() });
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
          const document = mockItemFirestoreDocumentAccessor.loadDocumentForKey(items[0].key);
          const exists = await document.accessor.exists();

          expect(exists).toBe(true);
        });

        itShouldFail('if the path is invalid (points to collection)', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForKey('path');
          });
        });

        itShouldFail('if the path points to a different type/collection', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForKey('path/id');
          });
        });

        itShouldFail('if the path is empty.', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForKey('');
          });
        });

        itShouldFail('if the path is undefined.', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForKey(undefined as any);
          });
        });

        itShouldFail('if the path is null.', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForKey(null as any);
          });
        });
      });

      describe('loadDocumentForId()', () => {
        it('should return a document with the given id.', () => {
          const document = mockItemFirestoreDocumentAccessor.loadDocumentForId('id');
          expect(document).toBeDefined();
        });

        itShouldFail('if the id is empty.', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForId('');
          });
        });

        itShouldFail('if the id is undefined.', () => {
          expectFail(() => {
            mockItemFirestoreDocumentAccessor.loadDocumentForId(undefined as any);
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
        const writeBatch: WriteBatch = c.context.batch();
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

  describe('create()', () => {
    it('should create the document if it does not exist.', async () => {
      const data = await c.accessor.get();

      await c.accessor.delete();

      let exists = await c.accessor.exists();
      expect(exists).toBe(false);

      await c.accessor.create(data);

      exists = await c.accessor.exists();
      expect(exists).toBe(true);
    });

    itShouldFail('if the document exists.', async () => {
      const data = await c.accessor.get();

      const exists = await c.accessor.exists();
      expect(exists).toBe(true);

      await expectFail(() => c.accessor.create(data));
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

    itShouldFail('if the document does not exist.', async () => {
      await c.accessor.delete();

      const snapshot = await c.accessor.get();
      expect(snapshot.data()).toBe(undefined);

      const exists = await c.accessor.exists();
      expect(exists).toBe(false);

      await expectFail(() => c.accessor.update(c.dataForUpdate()));
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
