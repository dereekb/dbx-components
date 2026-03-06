import { startOfDay, addDays, addHours } from 'date-fns';
import { callbackTest } from '@dereekb/util/test';
import { SubscriptionObject } from '@dereekb/rxjs';
import { first, map as rxMap } from 'rxjs';
import {
  where,
  makeDocuments,
  newDocuments,
  getDocumentSnapshots,
  getDocumentSnapshotPair,
  getDocumentSnapshotPairs,
  getDocumentSnapshotDataPair,
  getDocumentSnapshotDataPairs,
  getDocumentSnapshotDataPairsWithData,
  getDocumentSnapshotDataTuples,
  getDocumentSnapshotData,
  getDocumentSnapshotsData,
  getDataFromDocumentSnapshots,
  loadDocumentsForSnapshots,
  loadDocumentsForDocumentReferences,
  loadDocumentsForKeys,
  loadDocumentsForIds,
  loadDocumentsForDocumentReferencesFromValues,
  loadDocumentsForKeysFromValues,
  loadDocumentsForIdsFromValues,
  firestoreDocumentLoader,
  firestoreDocumentSnapshotPairsLoader,
  documentData,
  documentDataFunction,
  documentDataWithIdAndKey,
  setIdAndKeyFromSnapshotOnDocumentData,
  setIdAndKeyFromKeyIdRefOnDocumentData,
  useDocumentSnapshot,
  useDocumentSnapshotData,
  firestoreModelIdFromDocument,
  firestoreModelIdsFromDocuments,
  firestoreModelKeyFromDocument,
  firestoreModelKeysFromDocuments,
  documentReferenceFromDocument,
  documentReferencesFromDocuments,
  latestSnapshotsFromDocuments,
  mapLatestSnapshotsFromDocuments,
  streamDocumentSnapshotsData,
  dataFromDocumentSnapshots,
  streamDocumentSnapshotDataPairs,
  streamDocumentSnapshotDataPairsWithData,
  streamFromOnSnapshot
} from '@dereekb/firebase';
import { type MockItemCollectionFixture, MockItemDocument, type MockItem } from '../mock';
import { isEvenNumber, unique } from '@dereekb/util';

/**
 * Describes utility driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeFirestoreDocumentUtilityTests(f: MockItemCollectionFixture) {
  describe('FirestoreDocumentUtilities', () => {
    const testDocumentCount = 5;

    let items: MockItemDocument[];

    const startDate = addDays(startOfDay(new Date()), 1);
    const EVEN_TAG = 'even';
    const ODD_TAG = 'odd';

    beforeEach(async () => {
      items = await makeDocuments(f.instance.mockItemCollection.documentAccessor(), {
        count: testDocumentCount,
        init: (i) => {
          return {
            value: `${i}`,
            number: i,
            date: addHours(startDate, i),
            tags: [`${i}`, `${isEvenNumber(i) ? EVEN_TAG : ODD_TAG}`],
            test: true
          };
        }
      });
    });

    let sub: SubscriptionObject;

    beforeEach(() => {
      sub = new SubscriptionObject();
    });

    afterEach(() => {
      sub.destroy();
    });

    describe('query.util.ts', () => {
      // MARK: streamFromOnSnapshot
      describe('streamFromOnSnapshot()', () => {
        it('should call unsubscribe when the subscriber unsubscribes', () => {
          let unsubscribeCalled = false;

          const obs = streamFromOnSnapshot(({ next }) => {
            next('value');
            return () => {
              unsubscribeCalled = true;
            };
          });

          const subscription = obs.subscribe();
          expect(unsubscribeCalled).toBe(false);

          subscription.unsubscribe();
          expect(unsubscribeCalled).toBe(true);
        });

        it('should unsubscribe the onSnapshot listener when first() completes', () => {
          let unsubscribeCalled = false;

          const obs = streamFromOnSnapshot<string>(({ next }) => {
            next('value');
            return () => {
              unsubscribeCalled = true;
            };
          });

          // first() completes the subscriber, then RxJS tears down the source
          const subscription = obs.pipe(first()).subscribe();

          // After first() + subscribe complete synchronously, teardown should have run
          expect(subscription.closed).toBe(true);
          expect(unsubscribeCalled).toBe(true);
        });

        it(
          'should unsubscribe onSnapshot listeners from document streams after subscriber unsubscribes',
          callbackTest((done) => {
            sub.subscription = latestSnapshotsFromDocuments(items)
              .pipe(first())
              .subscribe({
                complete: () => {
                  // With refCount: true on shareReplay, unsubscribing the last subscriber
                  // tears down the source, which calls unsubscribe on each onSnapshot listener.
                  // If this test completes without the "active listeners" error, the cleanup worked.
                  done();
                }
              });
          })
        );
      });
    });

    describe('document.utility.ts', () => {
      // MARK: newDocuments
      describe('newDocuments()', () => {
        it('should create the specified number of document instances', () => {
          const count = 3;
          const docs = newDocuments(f.instance.mockItemCollection.documentAccessor(), count);

          expect(docs.length).toBe(count);
        });

        it('should create documents with unique IDs', () => {
          const docs = newDocuments(f.instance.mockItemCollection.documentAccessor(), 3);
          const ids = docs.map((x) => x.id);

          expect(unique(ids).length).toBe(3);
        });

        it('should not persist documents to Firestore', async () => {
          const docs = newDocuments(f.instance.mockItemCollection.documentAccessor(), 2);

          for (const doc of docs) {
            const exists = await doc.exists();
            expect(exists).toBe(false);
          }
        });
      });

      // MARK: makeDocuments
      describe('makeDocuments()', () => {
        it('should create and persist documents in Firestore', async () => {
          const count = 3;
          const docs = await makeDocuments(f.instance.mockItemCollection.documentAccessor(), {
            count,
            init: (i) => ({ value: `test_${i}`, test: true })
          });

          expect(docs.length).toBe(count);

          for (const doc of docs) {
            const exists = await doc.exists();
            expect(exists).toBe(true);
          }
        });

        it('should not persist documents when init returns null', async () => {
          const docs = await makeDocuments(f.instance.mockItemCollection.documentAccessor(), {
            count: 2,
            init: () => null
          });

          expect(docs.length).toBe(2);

          for (const doc of docs) {
            const exists = await doc.exists();
            expect(exists).toBe(false);
          }
        });

        it('should use custom newDocument factory when provided', async () => {
          const accessor = f.instance.mockItemCollection.documentAccessor();
          const customId = 'custom_doc_id';

          const docs = await makeDocuments(accessor, {
            count: 1,
            newDocument: (acc) => acc.loadDocumentForId(customId),
            init: () => ({ value: 'custom', test: true })
          });

          expect(docs.length).toBe(1);
          expect(docs[0].id).toBe(customId);

          const exists = await docs[0].exists();
          expect(exists).toBe(true);
        });
      });

      // MARK: getDocumentSnapshots
      describe('getDocumentSnapshots()', () => {
        it('should return snapshots for all documents', async () => {
          const snapshots = await getDocumentSnapshots(items);

          expect(snapshots.length).toBe(testDocumentCount);

          snapshots.forEach((snapshot) => {
            expect(snapshot.data()).toBeDefined();
          });
        });

        it('should preserve ordering of the input array', async () => {
          const snapshots = await getDocumentSnapshots(items);

          for (let i = 0; i < items.length; i++) {
            expect(snapshots[i].id).toBe(items[i].id);
          }
        });
      });

      // MARK: getDocumentSnapshotPair
      describe('getDocumentSnapshotPair()', () => {
        it('should return a pair with both document and snapshot', async () => {
          const pair = await getDocumentSnapshotPair(items[0]);

          expect(pair.document).toBe(items[0]);
          expect(pair.snapshot).toBeDefined();
          expect(pair.snapshot.data()).toBeDefined();
          expect(pair.snapshot.id).toBe(items[0].id);
        });
      });

      // MARK: getDocumentSnapshotPairs
      describe('getDocumentSnapshotPairs()', () => {
        it('should return pairs for all documents', async () => {
          const pairs = await getDocumentSnapshotPairs(items);

          expect(pairs.length).toBe(testDocumentCount);

          pairs.forEach((pair, i) => {
            expect(pair.document).toBe(items[i]);
            expect(pair.snapshot.data()).toBeDefined();
          });
        });
      });

      // MARK: getDocumentSnapshotDataPair
      describe('getDocumentSnapshotDataPair()', () => {
        it('should return a triplet with document, snapshot, and data with id/key', async () => {
          const pair = await getDocumentSnapshotDataPair(items[0]);

          expect(pair.document).toBe(items[0]);
          expect(pair.snapshot).toBeDefined();
          expect(pair.data).toBeDefined();
          expect(pair.data!.id).toBe(items[0].id);
          expect(pair.data!.key).toBe(items[0].key);
          expect(pair.data!.test).toBe(true);
        });

        it('should return undefined data for a non-existent document', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const pair = await getDocumentSnapshotDataPair(newDoc);

          expect(pair.document).toBe(newDoc);
          expect(pair.data).toBeUndefined();
        });
      });

      // MARK: getDocumentSnapshotDataPairs
      describe('getDocumentSnapshotDataPairs()', () => {
        it('should return triplets for all documents', async () => {
          const pairs = await getDocumentSnapshotDataPairs(items);

          expect(pairs.length).toBe(testDocumentCount);

          pairs.forEach((pair, i) => {
            expect(pair.document).toBe(items[i]);
            expect(pair.data).toBeDefined();
            expect(pair.data!.id).toBe(items[i].id);
            expect(pair.data!.key).toBe(items[i].key);
          });
        });
      });

      // MARK: getDocumentSnapshotDataPairsWithData
      describe('getDocumentSnapshotDataPairsWithData()', () => {
        it('should return triplets for all existing documents', async () => {
          const pairs = await getDocumentSnapshotDataPairsWithData(items);

          expect(pairs.length).toBe(testDocumentCount);

          pairs.forEach((pair) => {
            expect(pair.data).toBeDefined();
            expect(pair.data.id).toBeDefined();
            expect(pair.data.key).toBeDefined();
          });
        });

        it('should filter out non-existent documents', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const allDocs = [...items, newDoc];

          const pairs = await getDocumentSnapshotDataPairsWithData(allDocs);

          expect(pairs.length).toBe(testDocumentCount);
          expect(pairs.every((p) => p.data != null)).toBe(true);
        });
      });

      // MARK: getDocumentSnapshotDataTuples
      describe('getDocumentSnapshotDataTuples()', () => {
        it('should return [document, data] tuples for all documents', async () => {
          const tuples = await getDocumentSnapshotDataTuples(items);

          expect(tuples.length).toBe(testDocumentCount);

          tuples.forEach((tuple, i) => {
            expect(tuple[0]).toBe(items[i]);
            expect(tuple[1]).toBeDefined();
            expect(tuple[1]!.test).toBe(true);
          });
        });

        it('should return undefined data for non-existent documents', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const tuples = await getDocumentSnapshotDataTuples([newDoc]);

          expect(tuples.length).toBe(1);
          expect(tuples[0][0]).toBe(newDoc);
          expect(tuples[0][1]).toBeUndefined();
        });
      });

      // MARK: getDocumentSnapshotData
      describe('getDocumentSnapshotData()', () => {
        it('should return data with id and key by default', async () => {
          const data = await getDocumentSnapshotData(items[0]);

          expect(data).toBeDefined();
          expect(data!.id).toBe(items[0].id);
          expect(data!.key).toBe(items[0].key);
          expect(data!.test).toBe(true);
        });

        it('should return data with id and key when withId is true', async () => {
          const data = await getDocumentSnapshotData(items[0], true);

          expect(data).toBeDefined();
          expect(data!.id).toBe(items[0].id);
          expect(data!.key).toBe(items[0].key);
        });

        it('should return raw data without id/key when withId is false', async () => {
          const data = await getDocumentSnapshotData(items[0], false);

          expect(data).toBeDefined();
          expect(data!.test).toBe(true);
          expect((data as any).id).toBeUndefined();
          expect((data as any).key).toBeUndefined();
        });

        it('should return undefined for a non-existent document', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const data = await getDocumentSnapshotData(newDoc);

          expect(data).toBeUndefined();
        });
      });

      // MARK: getDocumentSnapshotsData
      describe('getDocumentSnapshotsData()', () => {
        it('should return data for all existing documents with id/key by default', async () => {
          const data = await getDocumentSnapshotsData(items);

          expect(data.length).toBe(testDocumentCount);

          data.forEach((d) => {
            expect(d.id).toBeDefined();
            expect(d.key).toBeDefined();
            expect(d.test).toBe(true);
          });
        });

        it('should return raw data without id/key when withId is false', async () => {
          const data = await getDocumentSnapshotsData(items, false);

          expect(data.length).toBe(testDocumentCount);

          data.forEach((d) => {
            expect(d.test).toBe(true);
          });
        });
      });

      // MARK: getDataFromDocumentSnapshots
      describe('getDataFromDocumentSnapshots()', () => {
        it('should extract data with id/key from snapshots', async () => {
          const snapshots = await getDocumentSnapshots(items);
          const data = getDataFromDocumentSnapshots(snapshots);

          expect(data.length).toBe(testDocumentCount);

          data.forEach((d) => {
            expect(d.id).toBeDefined();
            expect(d.key).toBeDefined();
          });
        });

        it('should extract raw data when withId is false', async () => {
          const snapshots = await getDocumentSnapshots(items);
          const data = getDataFromDocumentSnapshots(snapshots, false);

          expect(data.length).toBe(testDocumentCount);
        });

        it('should filter out non-existent document snapshots', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const allDocs = [...items, newDoc];

          const snapshots = await getDocumentSnapshots(allDocs);
          const data = getDataFromDocumentSnapshots(snapshots);

          expect(data.length).toBe(testDocumentCount);
        });
      });

      // MARK: loadDocumentsForSnapshots
      describe('loadDocumentsForSnapshots()', () => {
        it('should load documents from a query snapshot', async () => {
          const querySnapshot = await f.instance.mockItemCollection.query(where('test', '==', true)).getDocs();
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForSnapshots(accessor, querySnapshot);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc) => {
            expect(doc).toBeDefined();
            expect(doc.id).toBeDefined();
          });
        });
      });

      // MARK: loadDocumentsForDocumentReferences
      describe('loadDocumentsForDocumentReferences()', () => {
        it('should load documents from references', () => {
          const refs = items.map((x) => x.documentRef);
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForDocumentReferences(accessor, refs);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.id).toBe(items[i].id);
          });
        });
      });

      // MARK: loadDocumentsForDocumentReferencesFromValues
      describe('loadDocumentsForDocumentReferencesFromValues()', () => {
        it('should extract refs from values and load documents', () => {
          const values = items.map((x) => ({ ref: x.documentRef }));
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForDocumentReferencesFromValues(accessor, values, (v) => v.ref);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.id).toBe(items[i].id);
          });
        });
      });

      // MARK: loadDocumentsForKeys
      describe('loadDocumentsForKeys()', () => {
        it('should load documents from keys', () => {
          const keys = items.map((x) => x.key);
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForKeys(accessor, keys);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.key).toBe(items[i].key);
          });
        });
      });

      // MARK: loadDocumentsForKeysFromValues
      describe('loadDocumentsForKeysFromValues()', () => {
        it('should extract keys from values and load documents', () => {
          const values = items.map((x) => ({ k: x.key }));
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForKeysFromValues(accessor, values, (v) => v.k);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.key).toBe(items[i].key);
          });
        });
      });

      // MARK: loadDocumentsForIds
      describe('loadDocumentsForIds()', () => {
        it('should load documents from IDs', () => {
          const ids = items.map((x) => x.id);
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForIds(accessor, ids);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.id).toBe(items[i].id);
          });
        });
      });

      // MARK: loadDocumentsForIdsFromValues
      describe('loadDocumentsForIdsFromValues()', () => {
        it('should extract IDs from values and load documents', () => {
          const values = items.map((x) => ({ docId: x.id }));
          const accessor = f.instance.mockItemCollection.documentAccessor();

          const docs = loadDocumentsForIdsFromValues(accessor, values, (v) => v.docId);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.id).toBe(items[i].id);
          });
        });
      });

      // MARK: firestoreDocumentLoader
      describe('firestoreDocumentLoader()', () => {
        it('should create a loader that loads documents from references', () => {
          const loader = firestoreDocumentLoader(f.instance.mockItemCollection);
          const refs = items.map((x) => x.documentRef);

          const docs = loader(refs);

          expect(docs.length).toBe(testDocumentCount);

          docs.forEach((doc, i) => {
            expect(doc.id).toBe(items[i].id);
          });
        });
      });

      // MARK: firestoreDocumentSnapshotPairsLoader
      describe('firestoreDocumentSnapshotPairsLoader()', () => {
        it('should create a loader that converts snapshots to data pairs', async () => {
          const loader = firestoreDocumentSnapshotPairsLoader(f.instance.mockItemCollection);
          const snapshots = await getDocumentSnapshots(items);

          const pairs = loader(snapshots);

          expect(pairs.length).toBe(testDocumentCount);

          pairs.forEach((pair) => {
            expect(pair.document).toBeDefined();
            expect(pair.snapshot).toBeDefined();
            expect(pair.data).toBeDefined();
            expect(pair.data!.id).toBeDefined();
            expect(pair.data!.key).toBeDefined();
          });
        });
      });

      // MARK: documentData
      describe('documentData()', () => {
        it('should return data with id/key when withId is true', async () => {
          const snapshot = await items[0].accessor.get();
          const data = documentData(snapshot, true);

          expect(data).toBeDefined();
          expect(data!.id).toBe(items[0].id);
          expect(data!.key).toBe(items[0].key);
        });

        it('should return raw data when withId is false', async () => {
          const snapshot = await items[0].accessor.get();
          const data = documentData(snapshot, false);

          expect(data).toBeDefined();
          expect(data!.test).toBe(true);
        });
      });

      // MARK: documentDataFunction
      describe('documentDataFunction()', () => {
        it('should return a function that extracts data with id/key when withId is true', async () => {
          const fn = documentDataFunction<MockItem>(true);
          const snapshot = await items[0].accessor.get();
          const data = fn(snapshot);

          expect(data).toBeDefined();
          expect(data!.id).toBe(items[0].id);
          expect(data!.key).toBe(items[0].key);
        });

        it('should return a function that extracts raw data when withId is false', async () => {
          const fn = documentDataFunction<MockItem>(false);
          const snapshot = await items[0].accessor.get();
          const data = fn(snapshot);

          expect(data).toBeDefined();
          expect((data as any).id).toBeUndefined();
        });
      });

      // MARK: documentDataWithIdAndKey
      describe('documentDataWithIdAndKey()', () => {
        it('should extract data with id and key from a snapshot', async () => {
          const snapshot = await items[0].accessor.get();
          const data = documentDataWithIdAndKey(snapshot);

          expect(data).toBeDefined();
          expect(data!.id).toBe(items[0].id);
          expect(data!.key).toBe(items[0].key);
          expect(data!.test).toBe(true);
        });

        it('should return undefined for a non-existent document', async () => {
          const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
          const snapshot = await newDoc.accessor.get();
          const data = documentDataWithIdAndKey(snapshot);

          expect(data).toBeUndefined();
        });
      });

      // MARK: setIdAndKeyFromSnapshotOnDocumentData
      describe('setIdAndKeyFromSnapshotOnDocumentData()', () => {
        it('should mutate data in-place to add id and key from snapshot', async () => {
          const snapshot = await items[0].accessor.get();
          const rawData = { test: true } as MockItem;

          const result = setIdAndKeyFromSnapshotOnDocumentData(rawData, snapshot);

          expect(result.id).toBe(items[0].id);
          expect(result.key).toBe(items[0].key);
          expect(result).toBe(rawData as any); // same reference
        });
      });

      // MARK: setIdAndKeyFromKeyIdRefOnDocumentData
      describe('setIdAndKeyFromKeyIdRefOnDocumentData()', () => {
        it('should mutate data in-place to add id and key from model ref', () => {
          const rawData = { test: true } as MockItem;
          const modelRef = { id: items[0].id, key: items[0].key };

          const result = setIdAndKeyFromKeyIdRefOnDocumentData(rawData, modelRef);

          expect(result.id).toBe(items[0].id);
          expect(result.key).toBe(items[0].key);
          expect(result).toBe(rawData as any);
        });
      });

      // MARK: useDocumentSnapshot
      describe('useDocumentSnapshot()', () => {
        it('should fetch snapshot and pass it to the use callback', async () => {
          const result = await useDocumentSnapshot(items[0], (snapshot) => {
            expect(snapshot.data()).toBeDefined();
            return snapshot.id;
          });

          expect(result).toBe(items[0].id);
        });

        it('should return default value when document is null', async () => {
          const result = await useDocumentSnapshot(null, () => 'used', 'default');

          expect(result).toBe('default');
        });
      });

      // MARK: useDocumentSnapshotData
      describe('useDocumentSnapshotData()', () => {
        it('should fetch snapshot data and pass it to the use callback', async () => {
          const result = await useDocumentSnapshotData(items[0], (data) => {
            expect(data.test).toBe(true);
            return data.value;
          });

          expect(result).toBe('0');
        });

        it('should return default value when document is null', async () => {
          const result = await useDocumentSnapshotData(null, () => 'used', 'default');

          expect(result).toBe('default');
        });
      });

      // MARK: Key Accessors
      describe('firestoreModelIdFromDocument()', () => {
        it('should return the document ID', () => {
          const id = firestoreModelIdFromDocument(items[0]);
          expect(id).toBe(items[0].id);
        });
      });

      describe('firestoreModelIdsFromDocuments()', () => {
        it('should return IDs for all documents', () => {
          const ids = firestoreModelIdsFromDocuments(items);

          expect(ids.length).toBe(testDocumentCount);
          ids.forEach((id, i) => {
            expect(id).toBe(items[i].id);
          });
        });
      });

      describe('firestoreModelKeyFromDocument()', () => {
        it('should return the full Firestore path', () => {
          const key = firestoreModelKeyFromDocument(items[0]);
          expect(key).toBe(items[0].key);
        });
      });

      describe('firestoreModelKeysFromDocuments()', () => {
        it('should return keys for all documents', () => {
          const keys = firestoreModelKeysFromDocuments(items);

          expect(keys.length).toBe(testDocumentCount);
          keys.forEach((key, i) => {
            expect(key).toBe(items[i].key);
          });
        });
      });

      describe('documentReferenceFromDocument()', () => {
        it('should return the document reference', () => {
          const ref = documentReferenceFromDocument(items[0]);
          expect(ref).toBe(items[0].documentRef);
        });
      });

      describe('documentReferencesFromDocuments()', () => {
        it('should return references for all documents', () => {
          const refs = documentReferencesFromDocuments(items);

          expect(refs.length).toBe(testDocumentCount);
          refs.forEach((ref, i) => {
            expect(ref).toBe(items[i].documentRef);
          });
        });
      });
    });

    describe('document.rxjs.ts', () => {
      // MARK: latestSnapshotsFromDocuments
      describe('latestSnapshotsFromDocuments()', () => {
        it(
          'should emit snapshots for all documents',
          callbackTest((done) => {
            sub.subscription = latestSnapshotsFromDocuments(items)
              .pipe(first())
              .subscribe((snapshots) => {
                expect(snapshots.length).toBe(testDocumentCount);

                snapshots.forEach((snapshot, i) => {
                  expect(snapshot.data()).toBeDefined();
                  expect(snapshot.id).toBe(items[i].id);
                });

                done();
              });
          })
        );

        it(
          'should emit an empty array for empty input',
          callbackTest((done) => {
            sub.subscription = latestSnapshotsFromDocuments([])
              .pipe(first())
              .subscribe((snapshots) => {
                expect(snapshots.length).toBe(0);
                done();
              });
          })
        );
      });

      // MARK: mapLatestSnapshotsFromDocuments
      describe('mapLatestSnapshotsFromDocuments()', () => {
        it(
          'should apply the operator to each document stream',
          callbackTest((done) => {
            sub.subscription = mapLatestSnapshotsFromDocuments(
              items,
              rxMap((snapshot) => snapshot.id)
            )
              .pipe(first())
              .subscribe((ids) => {
                expect(ids.length).toBe(testDocumentCount);

                ids.forEach((id, i) => {
                  expect(id).toBe(items[i].id);
                });

                done();
              });
          })
        );

        it(
          'should emit an empty array for empty input',
          callbackTest((done) => {
            sub.subscription = mapLatestSnapshotsFromDocuments(
              [],
              rxMap((snapshot) => snapshot.id)
            )
              .pipe(first())
              .subscribe((ids) => {
                expect(ids.length).toBe(0);
                done();
              });
          })
        );
      });

      // MARK: streamDocumentSnapshotsData
      describe('streamDocumentSnapshotsData()', () => {
        it(
          'should emit data with id/key for all documents',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotsData(items)
              .pipe(first())
              .subscribe((data) => {
                expect(data.length).toBe(testDocumentCount);

                data.forEach((d) => {
                  expect(d.id).toBeDefined();
                  expect(d.key).toBeDefined();
                  expect(d.test).toBe(true);
                });

                done();
              });
          })
        );

        it(
          'should emit an empty array for empty input',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotsData([])
              .pipe(first())
              .subscribe((data) => {
                expect(data.length).toBe(0);
                done();
              });
          })
        );
      });

      // MARK: dataFromDocumentSnapshots operator
      describe('dataFromDocumentSnapshots()', () => {
        it(
          'should transform snapshot arrays into data arrays with id/key',
          callbackTest((done) => {
            sub.subscription = latestSnapshotsFromDocuments(items)
              .pipe(dataFromDocumentSnapshots(), first())
              .subscribe((data) => {
                expect(data.length).toBe(testDocumentCount);

                data.forEach((d) => {
                  expect(d.id).toBeDefined();
                  expect(d.key).toBeDefined();
                });

                done();
              });
          })
        );
      });

      // MARK: streamDocumentSnapshotDataPairs
      describe('streamDocumentSnapshotDataPairs()', () => {
        it(
          'should emit snapshot-data pairs for all documents',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotDataPairs(items)
              .pipe(first())
              .subscribe((pairs) => {
                expect(pairs.length).toBe(testDocumentCount);

                pairs.forEach((pair, i) => {
                  expect(pair.document).toBe(items[i]);
                  expect(pair.snapshot).toBeDefined();
                  expect(pair.snapshot.data()).toBeDefined();
                  expect(pair.data).toBeDefined();
                  expect(pair.data!.id).toBe(items[i].id);
                  expect(pair.data!.key).toBe(items[i].key);
                  expect(pair.data!.test).toBe(true);
                });

                done();
              });
          })
        );

        it(
          'should emit an empty array for empty input',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotDataPairs([])
              .pipe(first())
              .subscribe((pairs) => {
                expect(pairs.length).toBe(0);
                done();
              });
          })
        );
      });

      // MARK: streamDocumentSnapshotDataPairsWithData
      describe('streamDocumentSnapshotDataPairsWithData()', () => {
        it(
          'should emit snapshot-data pairs for all existing documents',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotDataPairsWithData(items)
              .pipe(first())
              .subscribe((pairs) => {
                expect(pairs.length).toBe(testDocumentCount);

                pairs.forEach((pair) => {
                  expect(pair.data).toBeDefined();
                  expect(pair.data.id).toBeDefined();
                  expect(pair.data.key).toBeDefined();
                });

                done();
              });
          })
        );

        it(
          'should filter out non-existent documents',
          callbackTest((done) => {
            const newDoc = newDocuments(f.instance.mockItemCollection.documentAccessor(), 1)[0];
            const allDocs = [...items, newDoc];

            sub.subscription = streamDocumentSnapshotDataPairsWithData(allDocs)
              .pipe(first())
              .subscribe((pairs) => {
                expect(pairs.length).toBe(testDocumentCount);
                expect(pairs.every((p) => p.data != null)).toBe(true);
                done();
              });
          })
        );

        it(
          'should emit an empty array for empty input',
          callbackTest((done) => {
            sub.subscription = streamDocumentSnapshotDataPairsWithData([])
              .pipe(first())
              .subscribe((pairs) => {
                expect(pairs.length).toBe(0);
                done();
              });
          })
        );
      });
    });
  });
}
