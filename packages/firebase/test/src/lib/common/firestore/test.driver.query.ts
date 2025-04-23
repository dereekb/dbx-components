import { startOfDay, addDays, addHours } from 'date-fns';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { SubscriptionObject } from '@dereekb/rxjs';
import { filter, first, from, skip } from 'rxjs';
import {
  firestoreIdBatchVerifierFactory,
  limit,
  orderBy,
  startAfter,
  startAt,
  where,
  limitToLast,
  endAt,
  endBefore,
  makeDocuments,
  type FirestoreQueryFactoryFunction,
  type FirestoreCollectionQueryFactoryFunction,
  startAtValue,
  endAtValue,
  whereDocumentId,
  type FirebaseAuthUserId,
  whereDateIsBetween,
  whereDateIsInRange,
  whereDateIsBeforeWithSort,
  whereDateIsOnOrAfterWithSort,
  whereStringValueHasPrefix,
  whereStringHasRootIdentityModelKey,
  iterateFirestoreDocumentSnapshotPairs,
  iterateFirestoreDocumentSnapshotBatches,
  iterateFirestoreDocumentSnapshotPairBatches,
  iterateFirestoreDocumentSnapshots,
  whereDateIsOnOrBeforeWithSort,
  whereDateIsAfterWithSort,
  type FirestoreDocumentSnapshotDataPair,
  loadAllFirestoreDocumentSnapshotPairs,
  loadAllFirestoreDocumentSnapshot,
  orderByDocumentId
} from '@dereekb/firebase';
import { type MockItemCollectionFixture, allChildMockItemSubItemDeepsWithinMockItem, MockItemDocument, type MockItem, type MockItemSubItemDocument, type MockItemSubItem, type MockItemSubItemDeepDocument, type MockItemSubItemDeep, type MockItemUserDocument, mockItemIdentity, type MockItemUserKey } from '../mock';
import { arrayFactory, idBatchFactory, isEvenNumber, mapGetter, randomFromArrayFactory, randomNumberFactory, unique, waitForMs } from '@dereekb/util';
import { DateRangeType } from '@dereekb/date';

/**
 * Describes query driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeFirestoreQueryDriverTests(f: MockItemCollectionFixture) {
  describe('FirestoreQueryDriver', () => {
    const testDocumentCount = 5;

    let items: MockItemDocument[];

    const startDate = addDays(startOfDay(new Date()), 1);
    const EVEN_TAG = 'even';
    const ODD_TAG = 'odd';

    beforeEach(async () => {
      items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
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

    describe('firestoreIdBatchVerifierFactory()', () => {
      const mockItemIdBatchVerifier = firestoreIdBatchVerifierFactory<MockItem, string>({
        readKeys: (x) => [x.id],
        fieldToQuery: '_id'
      });

      it('should query on the id field.', async () => {
        const takenIds = items.map((x) => x.id);

        const result = await f.instance.mockItemCollection.queryDocument(whereDocumentId('in', takenIds)).getDocs();
        expect(result).toBeDefined();
        expect(result.length).toBe(takenIds.length);
        expect(result.map((x) => x.id)).toContain(takenIds[0]);
      });

      it('should return ids that are not taken.', async () => {
        const takenIds = items.map((x) => x.id);

        const idFactory = arrayFactory(mapGetter(randomNumberFactory(10000000), (x) => `test-id-${x}`));
        const random = randomFromArrayFactory(takenIds);

        const factory = idBatchFactory<string, string>({
          verifier: mockItemIdBatchVerifier(f.instance.mockItemCollection),
          factory: (count) => {
            const ids = [random(), ...idFactory(count)];
            return ids;
          }
        });

        const idsToMake = 30;
        const result = await factory(idsToMake);

        expect(result).toBeDefined();
        expect(unique(result).length).toBe(idsToMake);
        expect(unique(result, takenIds).length).toBe(idsToMake);
      });
    });

    describe('mockItemUser', () => {
      let testUserId: FirebaseAuthUserId;
      let allMockUserItems: MockItemUserDocument[];

      beforeEach(async () => {
        testUserId = 'userid' + Math.ceil(Math.random() * 100000);

        const results = await Promise.all(
          items.map((parent: MockItemDocument) =>
            makeDocuments(f.instance.mockItemUserCollection(parent).documentAccessor(), {
              count: 1,
              newDocument: (x) => x.loadDocumentForId(testUserId),
              init: (i) => {
                return {
                  uid: '',
                  name: `name ${i}`
                };
              }
            })
          )
        );

        allMockUserItems = results.flat();
      });

      describe('utils', () => {
        describe('iterate load firestore utilities', () => {
          describe('loadAllFirestoreDocumentSnapshotPairs()', () => {
            it('should iterate batches of snapshot pairs.', async () => {
              const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();
              const mockUserItemsVisited = new Set<MockItemUserKey>();

              const result = await loadAllFirestoreDocumentSnapshotPairs({
                documentAccessor,
                iterateSnapshotPairsBatch: async (x) => {
                  x.forEach((y) => mockUserItemsVisited.add(y.document.key));

                  const pair = x[0];
                  expect(pair.data).toBeDefined();
                  expect(pair.snapshot).toBeDefined();
                  expect(pair.document).toBeDefined();
                },
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
              expect(result.snapshotPairs.length).toBe(allMockUserItems.length);

              expect(result.snapshotPairs[0].data).toBeDefined();
              expect(result.snapshotPairs[0].document).toBeDefined();
              expect(result.snapshotPairs[0].snapshot).toBeDefined();
            });
          });

          describe('loadAllFirestoreDocumentSnapshot()', () => {
            it('should iterate batches of snapshot pairs.', async () => {
              const mockUserItemsVisited = new Set<MockItemUserKey>();

              const result = await loadAllFirestoreDocumentSnapshot({
                iterateSnapshotsForCheckpoint: async (x) => {
                  x.forEach((y) => mockUserItemsVisited.add(y.ref.path));

                  const snapshot = x[0];
                  expect(snapshot.ref).toBeDefined();
                  expect(snapshot.data()).toBeDefined();
                },
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
              expect(result.snapshots.length).toBe(allMockUserItems.length);

              expect(result.snapshots[0].ref).toBeDefined();
              expect(result.snapshots[0].data()).toBeDefined();
            });
          });
        });

        describe('iterate firestore utilities', () => {
          describe('iterateFirestoreDocumentSnapshotPairs()', () => {
            it('should iterate across all mock users by each snapshot pair.', async () => {
              const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();

              const mockUserItemsVisited = new Set<MockItemUserKey>();
              const batchSize = 2;

              const result = await iterateFirestoreDocumentSnapshotPairs({
                batchSize,
                handleRepeatCursor: false, // exit immediately if the cursor is visited again
                filterCheckpointSnapshots: async (x) => {
                  return x;
                },
                iterateSnapshotPair: async (x) => {
                  expect(x.data).toBeDefined();
                  expect(x.snapshot).toBeDefined();
                  expect(x.document).toBeDefined();

                  const key = x.document.key;

                  if (mockUserItemsVisited.has(key)) {
                    throw new Error('encountered repeat key');
                  } else {
                    mockUserItemsVisited.add(key);
                  }
                },
                useCheckpointResult: async (x) => {
                  if (x.docSnapshots.length > 0) {
                    expect(x.results[0].snapshots.length).toBeLessThanOrEqual(batchSize);
                  }
                },
                documentAccessor,
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
            });

            describe('1 item exists', () => {
              let onlyItem: MockItemUserDocument;

              beforeEach(async () => {
                onlyItem = allMockUserItems.pop() as MockItemUserDocument;
                await Promise.all(allMockUserItems.map((x) => x.accessor.delete()));
                allMockUserItems = [onlyItem];
              });

              it('should iterate the single item', async () => {
                const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();
                const mockUserItemsVisited = new Set<MockItemUserKey>();

                expect(allMockUserItems).toHaveLength(1);

                const result = await iterateFirestoreDocumentSnapshotPairs({
                  iterateSnapshotPair: async (x) => {
                    expect(x.data).toBeDefined();
                    expect(x.snapshot).toBeDefined();
                    expect(x.document).toBeDefined();

                    const key = x.document.key;

                    if (mockUserItemsVisited.has(key)) {
                      throw new Error('encountered repeat key');
                    } else {
                      mockUserItemsVisited.add(key);
                    }
                  },
                  documentAccessor,
                  queryFactory: f.instance.mockItemUserCollectionGroup,
                  batchSize: null,
                  limitPerCheckpoint: 200,
                  totalSnapshotsLimit: 100,
                  performTasksConfig: {
                    maxParallelTasks: 20
                  },
                  constraintsFactory: [] // no constraints
                });

                expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
                expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              });

              // TODO(TEST): Case where a document was visited twice via iteration after it was updated. Assumed
              // to occur when the updated item matches an "or" case or other value when using "in". Cannot
              // reproduce at the moment.
              /*
              describe('scenario', () => {

                it('should visit the item twice if it is updated and matches a different filter', async () => {
                  const onlyItemValue = await onlyItem.snapshotData() as MockItemUser;
                  const nameToChangeTo = `${onlyItemValue.name}-changed`;
                  const namesToFilter = [onlyItemValue.name, nameToChangeTo];

                  const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();
                  const mockUserItemsVisited = new Set<MockItemUserKey>();
                  let updates = 0;

                  expect(allMockUserItems).toHaveLength(1);

                  const result = await iterateFirestoreDocumentSnapshotPairs({
                    iterateSnapshotPair: async (x) => {
                      expect(x.data).toBeDefined();
                      expect(x.snapshot).toBeDefined();
                      expect(x.document).toBeDefined();

                      await x.document.update({ name: nameToChangeTo });
                      updates += 1;

                      const key = x.document.key;
                      mockUserItemsVisited.add(key);
                    },
                    documentAccessor,
                    queryFactory: f.instance.mockItemUserCollectionGroup,
                    batchSize: null,
                    limitPerCheckpoint: 200,
                    totalSnapshotsLimit: 100,
                    performTasksConfig: {
                      maxParallelTasks: 20
                    },
                    constraintsFactory: () => [where<MockItemUser>('name', 'in', namesToFilter)],
                  });

                  expect(updates).toBe(2);
                  expect(result.totalSnapshotsVisited).toBe(2);
                  expect(mockUserItemsVisited.size).toBe(1);
                });

              });
              */
            });

            describe('0 items exists', () => {
              beforeEach(async () => {
                await Promise.all(allMockUserItems.map((x) => x.accessor.delete()));
              });

              it('should iterate no items', async () => {
                const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();
                const mockUserItemsVisited = new Set<MockItemUserKey>();

                const result = await iterateFirestoreDocumentSnapshotPairs({
                  iterateSnapshotPair: async (x) => {
                    expect(x.data).toBeDefined();
                    expect(x.snapshot).toBeDefined();
                    expect(x.document).toBeDefined();

                    const key = x.document.key;

                    if (mockUserItemsVisited.has(key)) {
                      throw new Error('encountered repeat key');
                    } else {
                      mockUserItemsVisited.add(key);
                    }
                  },
                  documentAccessor,
                  queryFactory: f.instance.mockItemUserCollectionGroup,
                  constraintsFactory: [] // no constraints
                });

                expect(result.totalSnapshotsVisited).toBe(0);
                expect(mockUserItemsVisited.size).toBe(0);
              });
            });
          });

          describe('iterateFirestoreDocumentSnapshots()', () => {
            it('should iterate across all mock users by each snapshot.', async () => {
              const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();

              const mockUserItemsVisited = new Set<MockItemUserKey>();
              const batchSize = 2;

              const result = await iterateFirestoreDocumentSnapshots({
                batchSize,
                iterateSnapshot: async (x) => {
                  const key = x.ref.path;

                  if (mockUserItemsVisited.has(key)) {
                    throw new Error('encountered repeat key');
                  } else {
                    mockUserItemsVisited.add(key);
                  }
                },
                useCheckpointResult: async (x) => {
                  if (x.docSnapshots.length > 0) {
                    expect(x.results[0].snapshots.length).toBeLessThanOrEqual(batchSize);
                  }
                },
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
            });
          });

          describe('iterateFirestoreDocumentSnapshotPairBatches()', () => {
            it('should iterate batches of snapshot pairs.', async () => {
              const documentAccessor = f.instance.mockItemUserCollectionGroup.documentAccessor();
              const mockUserItemsVisited = new Set<MockItemUserKey>();
              const batchSize = 2;

              const result = await iterateFirestoreDocumentSnapshotPairBatches({
                documentAccessor,
                batchSize, // use specific batch size
                iterateSnapshotPairsBatch: async (x) => {
                  expect(x.length).toBeLessThanOrEqual(batchSize);

                  const pair = x[0];
                  expect(pair.data).toBeDefined();
                  expect(pair.snapshot).toBeDefined();
                  expect(pair.document).toBeDefined();
                },
                useCheckpointResult: async (x) => {
                  x.docSnapshots.forEach((y) => mockUserItemsVisited.add(y.ref.path));
                },
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
            });
          });

          describe('iterateFirestoreDocumentSnapshotBatches()', () => {
            it('should iterate batches of snapshots.', async () => {
              const mockUserItemsVisited = new Set<MockItemUserKey>();
              const batchSize = 2;

              const result = await iterateFirestoreDocumentSnapshotBatches({
                batchSize, // use specific batch size
                iterateSnapshotBatch: async (x) => {
                  expect(x.length).toBeLessThanOrEqual(batchSize);
                },
                useCheckpointResult: async (x) => {
                  x.docSnapshots.forEach((y) => mockUserItemsVisited.add(y.ref.path));
                },
                queryFactory: f.instance.mockItemUserCollectionGroup,
                constraintsFactory: [] // no constraints
              });

              expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
              expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
            });

            describe('limitPerCheckpoint', () => {
              describe('limitPerCheckpoint = 0', () => {
                it('should not iterate any batches', async () => {
                  const result = await iterateFirestoreDocumentSnapshotBatches({
                    limitPerCheckpoint: 0,
                    iterateSnapshotBatch: async (x) => {
                      expect(x.length).toBe(0);
                    },
                    useCheckpointResult: async (x) => {
                      expect(x.docSnapshots.length).toBe(0);
                    },
                    queryFactory: f.instance.mockItemUserCollectionGroup,
                    constraintsFactory: [] // no constraints
                  });

                  expect(result.totalSnapshotsVisited).toBe(0);
                  expect(result.totalSnapshotsLimitReached).toBe(true);
                });
              });
            });

            describe('maxParallelCheckpoints>1', () => {
              it('should process the checkpoints in parallel.', async () => {
                const mockUserItemsVisited = new Set<MockItemUserKey>();
                const batchSize = 1;
                const maxParallelCheckpoints = 4;

                let currentRunningTasks = 0;
                let maxRunningTasks = 0;

                const result = await iterateFirestoreDocumentSnapshotBatches({
                  batchSize, // use specific batch size
                  limitPerCheckpoint: 1,
                  maxParallelCheckpoints, // do four checkpoints in parallel
                  iterateSnapshotBatch: async (x, batchIndex) => {
                    currentRunningTasks += 1;

                    await waitForMs(1000);
                    maxRunningTasks = Math.max(maxRunningTasks, currentRunningTasks);

                    currentRunningTasks -= 1;
                  },
                  useCheckpointResult: async (x) => {
                    x.docSnapshots.forEach((y) => mockUserItemsVisited.add(y.ref.path));
                  },
                  queryFactory: f.instance.mockItemUserCollectionGroup,
                  constraintsFactory: [] // no constraints
                });

                expect(maxRunningTasks).toBe(maxParallelCheckpoints);
                expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
                expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
              });
            });

            describe('batchSize=null', () => {
              it('should iterate with a single batch', async () => {
                const mockUserItemsVisited = new Set<MockItemUserKey>();
                const batchSize = null;

                const result = await iterateFirestoreDocumentSnapshotBatches({
                  batchSize, // use specific batch size
                  iterateSnapshotBatch: async (x) => {
                    expect(x.length).toBe(allMockUserItems.length);
                  },
                  useCheckpointResult: async (x) => {
                    x.docSnapshots.forEach((y) => mockUserItemsVisited.add(y.ref.path));
                  },
                  queryFactory: f.instance.mockItemUserCollectionGroup,
                  constraintsFactory: [] // no constraints
                });

                expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
                expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
              });
            });

            describe('batchSizeForSnapshots: () => null', () => {
              it('should iterate with a single batch', async () => {
                const mockUserItemsVisited = new Set<MockItemUserKey>();

                const result = await iterateFirestoreDocumentSnapshotBatches({
                  batchSizeForSnapshots: () => null,
                  iterateSnapshotBatch: async (x) => {
                    expect(x.length).toBe(allMockUserItems.length);
                  },
                  useCheckpointResult: async (x) => {
                    x.docSnapshots.forEach((y) => mockUserItemsVisited.add(y.ref.path));
                  },
                  queryFactory: f.instance.mockItemUserCollectionGroup,
                  constraintsFactory: [] // no constraints
                });

                expect(result.totalSnapshotsVisited).toBe(allMockUserItems.length);
                expect(mockUserItemsVisited.size).toBe(allMockUserItems.length);
              });
            });
          });
        });
      });

      describe('collection group', () => {
        describe('query', () => {
          describe('constraints', () => {
            describe('where', () => {
              it('should return the documents matching the input uid', async () => {
                const result = await f.instance.mockItemUserCollectionGroup.query(where('uid', '==', testUserId)).getDocs();
                expect(result.docs.length).toBe(testDocumentCount);

                result.docs.forEach((x) => {
                  expect(x.data().uid).toBe(testUserId);
                });
              });
            });
          });
        });
      });
    });

    describe('nested items', () => {
      const subItemCountPerItem = 2;
      const totalSubItemsCount = subItemCountPerItem * testDocumentCount;

      let parentA: MockItemDocument;

      let querySubItems: FirestoreQueryFactoryFunction<MockItemSubItem>;

      let allSubItems: MockItemSubItemDocument[];

      beforeEach(async () => {
        querySubItems = f.instance.mockItemSubItemCollectionGroup.query;
        parentA = items[0];

        const results = await Promise.all(
          items.map((parent: MockItemDocument) =>
            makeDocuments(f.instance.mockItemSubItemCollection(parent).documentAccessor(), {
              count: subItemCountPerItem,
              init: (i) => {
                return {
                  value: i
                };
              }
            })
          )
        );

        allSubItems = results.flat();
      });

      describe('sub sub item', () => {
        const deepSubItemCountPerItem = 1;
        const totalDeepSubItemsCount = deepSubItemCountPerItem * totalSubItemsCount;
        const totalDeepSubItemsPerMockItem = subItemCountPerItem * deepSubItemCountPerItem;

        let deepSubItemParentA: MockItemSubItemDocument;

        let queryDeepSubItems: FirestoreQueryFactoryFunction<MockItemSubItemDeep>;

        let allDeepSubItems: MockItemSubItemDeepDocument[];

        beforeEach(async () => {
          queryDeepSubItems = f.instance.mockItemSubItemDeepCollectionGroup.query;
          deepSubItemParentA = allSubItems[0];

          const results = await Promise.all(
            allSubItems.map((parent: MockItemSubItemDocument) =>
              makeDocuments(f.instance.mockItemSubItemDeepCollection(parent).documentAccessor(), {
                count: deepSubItemCountPerItem,
                init: (i) => {
                  return {
                    value: i
                  };
                }
              })
            )
          );

          allDeepSubItems = results.flat();
        });

        // tests querying for all nested items under a parent
        it('querying for only items belonging to mock item parentA', async () => {
          const result = await queryDeepSubItems(allChildMockItemSubItemDeepsWithinMockItem(parentA.documentRef)).getDocs();
          expect(result.docs.length).toBe(totalDeepSubItemsPerMockItem);
          result.docs.forEach((x) => expect(x.ref.parent?.parent?.parent?.parent?.path).toBe(parentA.documentRef.path));
        });

        // TODO(TEST): Add tests for allChildDocumentsUnderRelativePath
      });

      describe('sub item', () => {
        describe('collection group', () => {
          describe('query', () => {
            it('should return sub items', async () => {
              const result = await querySubItems().getDocs();
              expect(result.docs.length).toBe(totalSubItemsCount);
            });

            describe('constraints', () => {
              describe('where', () => {
                it('should return the documents matching the query.', async () => {
                  const value = 0;

                  const result = await querySubItems(where('value', '==', value)).getDocs();
                  expect(result.docs.length).toBe(testDocumentCount);
                  expect(result.docs[0].data().value).toBe(value);

                  const ref = result.docs[0].ref;
                  expect(ref).toBeDefined();
                  expect(ref.parent).toBeDefined();
                });
              });

              describe('whereDocumentId', () => {
                itShouldFail('to query on collection groups.', async () => {
                  // https://stackoverflow.com/questions/56149601/firestore-collection-group-query-on-documentid

                  const targetId = 'targetid';

                  /*
                  const results = await Promise.all(
                    allSubItems.map((parent: MockItemSubItemDocument) =>
                      makeDocuments(f.instance.mockItemSubItemDeepCollection(parent).documentAccessor(), {
                        count: 1,
                        newDocument: (x) => x.loadDocumentForId(targetId),
                        init: (i) => {
                          return {
                            value: i
                          };
                        }
                      })
                    )
                  );
                  */

                  await expectFail(() => querySubItems(whereDocumentId('==', targetId)).getDocs());
                });
              });
            });

            describe('streamDocs()', () => {
              let sub: SubscriptionObject;

              beforeEach(() => {
                sub = new SubscriptionObject();
              });

              afterEach(() => {
                sub.destroy();
              });

              it('should emit when the query results update (an item is added).', (done) => {
                const itemsToAdd = 1;

                let addCompleted = false;
                let addSeen = false;

                function tryComplete() {
                  if (addSeen && addCompleted) {
                    done();
                  }
                }

                sub.subscription = querySubItems()
                  .streamDocs()
                  .pipe(filter((x) => x.docs.length > allSubItems.length))
                  .subscribe((results) => {
                    addSeen = true;
                    expect(results.docs.length).toBe(allSubItems.length + itemsToAdd);
                    tryComplete();
                  });

                // add one item
                makeDocuments(f.instance.mockItemSubItemCollection(parentA).documentAccessor(), {
                  count: itemsToAdd,
                  init: (i) => {
                    return {
                      value: i
                    };
                  }
                }).then(() => {
                  addCompleted = true;
                  tryComplete();
                });
              });

              it('should emit when the query results update (an item is removed).', (done) => {
                const itemsToRemove = 1;

                let deleteCompleted = false;
                let deleteSeen = false;

                function tryComplete() {
                  if (deleteSeen && deleteCompleted) {
                    done();
                  }
                }

                sub.subscription = querySubItems()
                  .streamDocs()
                  .pipe(filter((x) => x.docs.length < allSubItems.length))
                  .subscribe((results) => {
                    deleteSeen = true;
                    expect(results.docs.length).toBe(allSubItems.length - itemsToRemove);
                    tryComplete();
                  });

                allSubItems[0].accessor.exists().then((exists) => {
                  expect(exists).toBe(true);

                  // remove one item
                  return allSubItems[0].accessor.delete().then(() => {
                    deleteCompleted = true;
                    tryComplete();
                  });
                });
              });
            });
          });
        });
      });
    });

    describe('queryDocument', () => {
      let queryDocument: FirestoreCollectionQueryFactoryFunction<MockItem, MockItemDocument>;

      beforeEach(async () => {
        queryDocument = f.instance.firestoreCollection.queryDocument;
      });

      describe('filter()', () => {
        it('should apply the filter to the query', async () => {
          const results = (await queryDocument()
            .filter(where<MockItem>('tags', 'array-contains', EVEN_TAG))
            .getDocSnapshotDataPairs()) as FirestoreDocumentSnapshotDataPair<MockItemDocument>[];

          expect(results).toBeDefined();

          results.forEach((result) => {
            expect(result.data).toBeDefined();
            expect(result.data?.tags).toContain(EVEN_TAG);
            expect(result.document).toBeDefined();
            expect(result.document instanceof MockItemDocument).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.data()).toBeDefined();
            expect(result.snapshot.ref).toBeDefined();
            expect(result.snapshot.id).toBe(result.document.id);
          });
        });

        it('should add more filters to the existing query', async () => {
          const results = (await queryDocument()
            .filter(where<MockItem>('tags', 'array-contains', EVEN_TAG))
            .filter(where<MockItem>('number', '>=', 4))
            .getDocSnapshotDataPairs()) as FirestoreDocumentSnapshotDataPair<MockItemDocument>[];

          expect(results).toBeDefined();
          expect(results.length).toBe(1);

          results.forEach((result) => {
            expect(result.data).toBeDefined();
            expect(result.data?.tags).toContain(EVEN_TAG);
            expect(result.data?.number).toBeGreaterThanOrEqual(4);
            expect(result.document).toBeDefined();
            expect(result.document instanceof MockItemDocument).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.data()).toBeDefined();
            expect(result.snapshot.ref).toBeDefined();
            expect(result.snapshot.id).toBe(result.document.id);
          });
        });
      });

      describe('getFirstDocSnapshotDataPair()', () => {
        it('should return undefined if the query contains nothing', async () => {
          const result = (await queryDocument(where<MockItem>('value', '==', '_DOES_NOT_EXIST_')).getFirstDocSnapshotDataPair()) as FirestoreDocumentSnapshotDataPair<MockItemDocument>;
          expect(result).not.toBeDefined();
        });

        it('should return the first doc that matches if it exists', async () => {
          const result = (await queryDocument().getFirstDocSnapshotDataPair()) as FirestoreDocumentSnapshotDataPair<MockItemDocument>;

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(result.document).toBeDefined();
          expect(result.document instanceof MockItemDocument).toBe(true);
          expect(result.snapshot).toBeDefined();
          expect(result.snapshot.data()).toBeDefined();
          expect(result.snapshot.ref).toBeDefined();
          expect(result.snapshot.id).toBe(result.document.id);
        });
      });

      describe('getDocSnapshotDataPairs()', () => {
        it('should return an empty array if the query returns nothing', async () => {
          const result = await queryDocument(where<MockItem>('value', '==', '_DOES_NOT_EXIST_')).getDocSnapshotDataPairs();
          expect(result).toBeDefined();
          expect(result.length).toBe(0);
        });

        it('should return the matching results', async () => {
          const results = await queryDocument().getDocSnapshotDataPairs();

          expect(results).toBeDefined();
          expect(results.length).toBeGreaterThan(0);

          results.forEach((result) => {
            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.document).toBeDefined();
            expect(result.document instanceof MockItemDocument).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot.data()).toBeDefined();
            expect(result.snapshot.ref).toBeDefined();
            expect(result.snapshot.id).toBe(result.document.id);
          });
        });
      });

      describe('streamDocs()', () => {
        let sub: SubscriptionObject;

        beforeEach(() => {
          sub = new SubscriptionObject();
        });

        afterEach(() => {
          sub.destroy();
        });

        it('should emit when the query results update (an item is added).', (done) => {
          const itemsToAdd = 1;

          let addCompleted = false;
          let addSeen = false;

          function tryComplete() {
            if (addSeen && addCompleted) {
              done();
            }
          }

          sub.subscription = queryDocument()
            .streamDocs()
            .pipe(filter((documents) => documents.length > items.length))
            .subscribe((documents) => {
              addSeen = true;
              expect(documents.length).toBe(items.length + itemsToAdd);
              tryComplete();
            });

          // add one item
          waitForMs(10).then(() =>
            makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
              count: itemsToAdd,
              init: (i) => {
                return {
                  value: `${i + items.length}`,
                  test: true
                };
              }
            }).then(() => {
              addCompleted = true;
              tryComplete();
            })
          );
        });

        it('should emit when the query results update (an item is removed).', (done) => {
          const itemsToRemove = 1;

          let deleteCompleted = false;
          let deleteSeen = false;

          function tryComplete() {
            if (deleteSeen && deleteCompleted) {
              done();
            }
          }

          sub.subscription = queryDocument()
            .streamDocs()
            .pipe(skip(1))
            .subscribe((documents) => {
              deleteSeen = true;
              expect(documents.length).toBe(items.length - itemsToRemove);
              tryComplete();
            });

          waitForMs(10).then(() =>
            items[0].exists().then((exists) => {
              expect(exists).toBe(true);

              // remove one item
              return items[0].accessor.delete().then(() => {
                deleteCompleted = true;
                tryComplete();
              });
            })
          );
        });
      });

      describe('streamDocSnapshotDataPairs()', () => {
        let sub: SubscriptionObject;

        beforeEach(() => {
          sub = new SubscriptionObject();
        });

        afterEach(() => {
          sub.destroy();
        });

        it('should emit when the query results update (an item is added).', (done) => {
          const itemsToAdd = 1;

          let addCompleted = false;
          let addSeen = false;

          function tryComplete() {
            if (addSeen && addCompleted) {
              done();
            }
          }

          sub.subscription = queryDocument()
            .streamDocSnapshotDataPairs()
            .pipe(filter((documents) => documents.length > items.length))
            .subscribe((documents) => {
              addSeen = true;
              expect(documents.length).toBe(items.length + itemsToAdd);

              documents.forEach((x) => {
                // validate each document returned
                expect(x.data).toBeDefined();
                expect(x.document).toBeDefined();
                expect(x.document instanceof MockItemDocument).toBe(true);
                expect(x.snapshot).toBeDefined();
                expect(x.snapshot.data()).toBeDefined();
                expect(x.snapshot.ref).toBeDefined();
                expect(x.snapshot.id).toBe(x.document.id);
              });

              tryComplete();
            });

          // add one item
          waitForMs(10).then(() =>
            makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
              count: itemsToAdd,
              init: (i) => {
                return {
                  value: `${i + items.length}`,
                  test: true
                };
              }
            }).then(() => {
              addCompleted = true;
              tryComplete();
            })
          );
        });

        it('should emit when the query results update (an item is removed).', (done) => {
          const itemsToRemove = 1;

          let deleteCompleted = false;
          let deleteSeen = false;

          function tryComplete() {
            if (deleteSeen && deleteCompleted) {
              done();
            }
          }

          sub.subscription = queryDocument()
            .streamDocs()
            .pipe(skip(1))
            .subscribe((documents) => {
              deleteSeen = true;
              expect(documents.length).toBe(items.length - itemsToRemove);
              tryComplete();
            });

          waitForMs(10).then(() =>
            items[0].exists().then((exists) => {
              expect(exists).toBe(true);

              // remove one item
              return items[0].accessor.delete().then(() => {
                deleteCompleted = true;
                tryComplete();
              });
            })
          );
        });
      });
    });

    describe('query', () => {
      let query: FirestoreQueryFactoryFunction<MockItem>;

      beforeEach(async () => {
        query = f.instance.firestoreCollection.query;
      });

      describe('streamDocs()', () => {
        let sub: SubscriptionObject;

        beforeEach(() => {
          sub = new SubscriptionObject();
        });

        afterEach(() => {
          sub.destroy();
        });

        it('should emit when the query results update (an item is added).', (done) => {
          const itemsToAdd = 1;

          let addCompleted = false;
          let addSeen = false;

          function tryComplete() {
            if (addSeen && addCompleted) {
              done();
            }
          }

          sub.subscription = query()
            .streamDocs()
            .pipe(filter((x) => x.docs.length > items.length))
            .subscribe((results) => {
              addSeen = true;
              expect(results.docs.length).toBe(items.length + itemsToAdd);
              tryComplete();
            });

          // add one item
          waitForMs(10).then(() =>
            makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
              count: itemsToAdd,
              init: (i) => {
                return {
                  value: `${i + items.length}`,
                  test: true
                };
              }
            }).then(() => {
              addCompleted = true;
              tryComplete();
            })
          );
        });

        it('should emit when the query results update (an item is removed).', (done) => {
          const itemsToRemove = 1;

          let deleteCompleted = false;
          let deleteSeen = false;

          function tryComplete() {
            if (deleteSeen && deleteCompleted) {
              done();
            }
          }

          sub.subscription = query()
            .streamDocs()
            .pipe(skip(1))
            .subscribe((results) => {
              deleteSeen = true;
              expect(results.docs.length).toBe(items.length - itemsToRemove);
              tryComplete();
            });

          waitForMs(10).then(() =>
            items[0].accessor.exists().then((exists) => {
              expect(exists).toBe(true);

              // remove one item
              return items[0].accessor.delete().then(() => {
                deleteCompleted = true;
                tryComplete();
              });
            })
          );
        });
      });

      describe('constraint', () => {
        describe('limit', () => {
          it('should limit the number of items returned.', async () => {
            const limitCount = 2;

            const unlimited = await query().getDocs();
            expect(unlimited.docs.length).toBe(testDocumentCount);

            const result = await query(limit(limitCount)).getDocs();
            expect(result.docs.length).toBe(limitCount);
          });

          it('should limit the streamed results.', (done) => {
            const limitCount = 2;
            const resultObs = query(limit(limitCount)).streamDocs();

            from(resultObs)
              .pipe(first())
              .subscribe((results) => {
                expect(results.docs.length).toBe(limitCount);
                done();
              });
          });

          it('should limit the number of items counted.', async () => {
            const limitCount = 2;

            const unlimited = await query().countDocs();
            expect(unlimited).toBe(testDocumentCount);

            const result = await query(limit(limitCount)).countDocs();
            expect(result).toBe(limitCount);
          });
        });

        describe('limitToLast', () => {
          it('should limit the number of items returned.', async () => {
            const limitCount = 2;

            const unlimited = await query().getDocs();
            expect(unlimited.docs.length).toBe(testDocumentCount);

            const result = await query(orderBy('value'), limitToLast(limitCount)).getDocs();
            expect(result.docs.length).toBe(limitCount);
          });

          it('the results should be returned from the end of the list. The results are still in the same order as requested.', async () => {
            const limitCount = 2;

            const result = await query(orderBy('value', 'asc'), limitToLast(limitCount)).getDocs();
            expect(result.docs.length).toBe(limitCount);
            expect(result.docs[0].data().value).toBe('3');
            expect(result.docs[1].data().value).toBe('4');
          });

          itShouldFail('if orderby is not provided.', async () => {
            const limitCount = 2;

            const unlimited = await query().getDocs();
            expect(unlimited.docs.length).toBe(testDocumentCount);

            await expectFail(() => query(limitToLast(limitCount)).getDocs());
          });

          it('should stream results.', (done) => {
            const limitCount = 2;
            const resultObs = query(orderBy('value'), limitToLast(limitCount)).streamDocs();

            from(resultObs)
              .pipe(first())
              .subscribe((results) => {
                expect(results.docs.length).toBe(limitCount);
                done();
              });
          });

          it('should limit the number of items counted.', async () => {
            const limitCount = 2;

            const unlimited = await query().countDocs();
            expect(unlimited).toBe(testDocumentCount);

            const result = await query(orderBy('value'), limitToLast(limitCount)).countDocs();
            expect(result).toBe(limitCount);
          });
        });

        describe('orderBy', () => {
          it('should return values sorted in ascending order.', async () => {
            const results = await query(orderBy('value', 'asc')).getDocs();
            expect(results.docs[0].data().value).toBe('0');
          });

          it('should return values sorted in descending order.', async () => {
            const results = await query(orderBy('value', 'desc')).getDocs();
            expect(results.docs[0].data().value).toBe(`${items.length - 1}`);
          });
        });

        describe('where', () => {
          describe('==', () => {
            it('should return the documents matching the query.', async () => {
              const value = '0';

              const result = await query(where('value', '==', value)).getDocs();
              expect(result.docs.length).toBe(1);
              expect(result.docs[0].data().value).toBe(value);
            });

            it('should return the count of the documents matching the query.', async () => {
              const value = '0';

              const result = await query(where('value', '==', value)).countDocs();
              expect(result).toBe(1);
            });
          });

          describe('in', () => {
            it('should return the documents with any of the input values.', async () => {
              const targetValue = ['0', '1', '2'];

              const result = await query(where<MockItem>('value', 'in', targetValue)).getDocs();
              expect(result.docs.length).toBe(3);
              const values = result.docs.map((x) => x.data().value);

              expect(values).toContain('0');
              expect(values).toContain('1');
              expect(values).toContain('2');
            });

            it('should return the count of documents with any of the input values.', async () => {
              const targetValue = ['0', '1', '2'];

              const result = await query(where<MockItem>('value', 'in', targetValue)).countDocs();
              expect(result).toBe(3);
            });
          });

          describe('not-in', () => {
            it('should return the documents that do not contain any of the input values.', async () => {
              const targetValue = ['0', '1', '2'];

              const result = await query(where<MockItem>('value', 'not-in', targetValue)).getDocs();
              expect(result.docs.length).toBe(2);
              const values = result.docs.map((x) => x.data().value);

              expect(values).not.toContain('0');
              expect(values).not.toContain('1');
              expect(values).not.toContain('2');
              expect(values).toContain('3');
              expect(values).toContain('4');
            });

            it('should return the count of documents that do not contain any of the input values.', async () => {
              const targetValue = ['0', '1', '2'];

              const result = await query(where<MockItem>('value', 'not-in', targetValue)).countDocs();
              expect(result).toBe(2);
            });
          });

          describe('searching array values', () => {
            describe('in', () => {
              it('should return the documents with arrays that only have the given values.', async () => {
                // NOTE: we pass an array to match exactly
                const targetValue = [['0', 'even']];

                const result = await query(where<MockItem>('tags', 'in', targetValue)).getDocs();
                expect(result.docs.length).toBe(1);
                expect(result.docs[0].data().value).toBe('0');
              });

              it('should not return the document with arrays that have more than the requested values.', async () => {
                const targetValue = [['0']];

                const result = await query(where<MockItem>('tags', 'in', targetValue)).getDocs();
                expect(result.docs.length).toBe(0);
              });

              it('should return the count of documents with arrays that only have the given values.', async () => {
                // NOTE: we pass an array to match exactly
                const targetValue = [['0', 'even']];

                const result = await query(where<MockItem>('tags', 'in', targetValue)).countDocs();
                expect(result).toBe(1);
              });
            });

            describe('array-contains', () => {
              it('should return the documents that contain the given value.', async () => {
                const targetValue = '0';

                const result = await query(where<MockItem>('tags', 'array-contains', targetValue)).getDocs();
                expect(result.docs.length).toBe(1);
                expect(result.docs[0].data().value).toBe('0');
              });

              itShouldFail('if an array is passed to where with array-contains', async () => {
                const targetValues = ['0', 'even'];
                await expectFail(() => query(where<MockItem>('tags', 'array-contains', targetValues)).getDocs());
              });
            });

            describe('array-contains-any', () => {
              it('should return the documents that contain the given value, even if it is not passed as an array.', async () => {
                const targetValues = 'even';

                const result = await query(where<MockItem>('tags', 'array-contains-any', targetValues)).getDocs();
                expect(result.docs.length).toBe(Math.floor(testDocumentCount / 2) + 1);

                result.docs.forEach((x) => {
                  expect(isEvenNumber(Number(x.data().value)));
                });
              });

              it('should return the documents that contain any of the given values.', async () => {
                const targetValues = ['0', 'even'];

                const result = await query(where<MockItem>('tags', 'array-contains-any', targetValues)).getDocs();
                expect(result.docs.length).toBe(Math.floor(testDocumentCount / 2) + 1);

                result.docs.forEach((x) => {
                  expect(isEvenNumber(Number(x.data().value)));
                });
              });
            });
          });

          describe('Compound Queries', () => {
            describe('Searching Strings', () => {
              /*
                  Create models that have model key like string values for prefix searching.
                 */
              const evenPrefix = mockItemIdentity.collectionType + '/';
              const oddPrefix = mockItemIdentity.collectionType + 'd' + '/'; // similar, but not quite the same

              const expectedNumberOfEvenValues = Math.ceil(testDocumentCount / 2);

              beforeEach(async () => {
                items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
                  count: testDocumentCount,
                  init: (i) => {
                    const isEven = isEvenNumber(i);
                    const prefix = isEven ? evenPrefix : oddPrefix;

                    return {
                      value: `${prefix}${i}`,
                      date: new Date(),
                      tags: [],
                      test: true
                    };
                  }
                });
              });

              describe('whereStringHasRootIdentityModelKey()', () => {
                it('should return only models with searched prefix', async () => {
                  const result = await query(whereStringHasRootIdentityModelKey<MockItem>('value', mockItemIdentity)).getDocs();
                  const values = result.docs.map((x) => x.data().value as string);

                  values.forEach((x) => {
                    expect(x.startsWith(evenPrefix));
                  });

                  expect(result.docs.length).toBe(expectedNumberOfEvenValues);
                });

                it('should return the count of only models with searched prefix', async () => {
                  const result = await query(whereStringHasRootIdentityModelKey<MockItem>('value', mockItemIdentity)).countDocs();
                  expect(result).toBe(expectedNumberOfEvenValues);
                });
              });

              describe('whereStringValueHasPrefix()', () => {
                it('should return only models with searched prefix', async () => {
                  const result = await query(whereStringValueHasPrefix<MockItem>('value', evenPrefix)).getDocs();
                  const values = result.docs.map((x) => x.data().value as string);

                  values.forEach((x) => {
                    expect(x.startsWith(evenPrefix));
                  });

                  expect(result.docs.length).toBe(expectedNumberOfEvenValues);
                });
              });
            });

            /**
             * Since we choose to store dates as strings, we can compare ranges of dates.
             */
            describe('Searching Date Strings', () => {
              describe('whereDateIsAfterWithSort()', () => {
                it('should return models with dates after the input.', async () => {
                  const startHoursLater = 2;

                  const start = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsAfterWithSort<MockItem>('date', start)).getDocs();

                  expect(result.docs.length).toBe(startHoursLater);

                  // ascending order by default
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 2).toISOString());
                });

                it('should return models with dates after the input in descending order.', async () => {
                  const startHoursLater = 2;

                  const start = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsAfterWithSort<MockItem>('date', start, 'desc')).getDocs();

                  expect(result.docs.length).toBe(startHoursLater);

                  // check descending order
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(start, 2).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                });
              });

              describe('whereDateIsBeforeWithSort()', () => {
                it('should return models with dates before the input.', async () => {
                  const startHoursLater = 2;

                  const endDate = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsBeforeWithSort<MockItem>('date', endDate)).getDocs();

                  expect(result.docs.length).toBe(startHoursLater);

                  // descending order by default
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(endDate, -1).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(endDate, -2).toISOString());
                });

                it('should return models with dates before the input in ascending order.', async () => {
                  const startHoursLater = 2;

                  const endDate = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsBeforeWithSort<MockItem>('date', endDate, 'asc')).getDocs();

                  expect(result.docs.length).toBe(startHoursLater);

                  // check ascending order
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(endDate, -2).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(endDate, -1).toISOString());
                });
              });

              describe('whereDateIsOnOrAfterWithSort()', () => {
                it('should return models with dates after the input.', async () => {
                  const startHoursLater = 2;

                  const start = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsOnOrAfterWithSort<MockItem>('date', start)).getDocs();

                  expect(result.docs.length).toBe(3);

                  // ascending order by default
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(start, 0).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                  expect(result.docs[2].data().date?.toISOString()).toBe(addHours(start, 2).toISOString());
                });

                it('should return models with dates after the input in descending order.', async () => {
                  const startHoursLater = 2;

                  const start = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsOnOrAfterWithSort<MockItem>('date', start, 'desc')).getDocs();

                  expect(result.docs.length).toBe(3);

                  // check descending order
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(start, 2).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                  expect(result.docs[2].data().date?.toISOString()).toBe(addHours(start, 0).toISOString());
                });
              });

              describe('whereDateIsOnOrBeforeWithSort()', () => {
                it('should return models with dates before the input.', async () => {
                  const startHoursLater = 2;

                  const endDate = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsOnOrBeforeWithSort<MockItem>('date', endDate)).getDocs();

                  expect(result.docs.length).toBe(3);

                  // descending order by default
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(endDate, 0).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(endDate, -1).toISOString());
                  expect(result.docs[2].data().date?.toISOString()).toBe(addHours(endDate, -2).toISOString());
                });

                it('should return models with dates before the input in ascending order.', async () => {
                  const startHoursLater = 2;

                  const endDate = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsOnOrBeforeWithSort<MockItem>('date', endDate, 'asc')).getDocs();

                  expect(result.docs.length).toBe(3);

                  // check ascending order
                  expect(result.docs[0].data().date?.toISOString()).toBe(addHours(endDate, -2).toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(endDate, -1).toISOString());
                  expect(result.docs[2].data().date?.toISOString()).toBe(addHours(endDate, 0).toISOString());
                });
              });

              describe('whereDateIsInRange()', () => {
                it('should return the date values within the given range.', async () => {
                  const startHoursLater = 1;
                  const totalHoursInRange = 2;

                  const start = addHours(startDate, startHoursLater);
                  const result = await query(whereDateIsInRange<MockItem>('date', { date: start, distance: totalHoursInRange - 1, type: DateRangeType.HOURS_RANGE })).getDocs();

                  expect(result.docs.length).toBe(totalHoursInRange);
                  expect(result.docs[0].data().date?.toISOString()).toBe(start.toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                });
              });

              describe('whereDateIsBetween()', () => {
                it('should return the date values within the given range.', async () => {
                  const startHoursLater = 1;
                  const hoursRange = 2;

                  const start = addHours(startDate, startHoursLater);
                  const end = addHours(start, hoursRange);

                  const result = await query(whereDateIsBetween<MockItem>('date', { start, end })).getDocs();

                  expect(result.docs.length).toBe(hoursRange);
                  expect(result.docs[0].data().date?.toISOString()).toBe(start.toISOString());
                  expect(result.docs[1].data().date?.toISOString()).toBe(addHours(start, 1).toISOString());
                });

                describe('with searching array value', () => {
                  it('should search the date range and values that are tagged even.', async () => {
                    const targetTag = 'even';

                    const startHoursLater = 1;
                    const hoursRange = 2;

                    const start = addHours(startDate, startHoursLater);
                    const end = addHours(start, hoursRange);

                    const result = await query([
                      // filter by dates first
                      ...whereDateIsBetween<MockItem>('date', { start, end }),
                      // only allow even items
                      where<MockItem>('tags', 'array-contains-any', targetTag)
                    ]).getDocs();

                    expect(result.docs.length).toBe(1);

                    const onlyResultData = result.docs[0].data();

                    expect(onlyResultData.date?.toISOString()).toBe(addHours(start, 1).toISOString());
                    expect(onlyResultData.tags).toContain(targetTag);
                  });
                });
              });
            });
          });
        });

        describe('whereDocumentId', () => {
          it('should return the documents matching the query.', async () => {
            const targetId = items[0].id;

            const result = await query(whereDocumentId('==', targetId)).getDocs();
            expect(result.docs.length).toBe(1);
            expect(result.docs[0].id).toBe(targetId);
          });
        });

        describe('startAt', () => {
          it('should return values starting from the specified startAt document.', async () => {
            const limitCount = 2;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const second = await firstQuery.filter(startAt(first.docs[1])).getDocs();
            expect(second.docs.length).toBe(limitCount);
            expect(second.docs[0].id).toBe(first.docs[1].id);
          });

          it('should return the count of values starting from the specified startAt document.', async () => {
            const limitCount = 2;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            // NOTE: startAt with count requires an orderBy to be set.
            const secondCount = await firstQuery.filter(orderByDocumentId(), startAt(first.docs[1])).countDocs();
            expect(secondCount).toBe(limitCount);
          });
        });

        describe('startAtValue', () => {
          it('should return values starting from the specified startAt path.', async () => {
            const limitCount = testDocumentCount;

            const firstQuery = query(orderBy<MockItem>('value'), limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const indexToStartAt = 3;
            const docToStartAt = first.docs[indexToStartAt];
            const docToStartAtValue = docToStartAt.data().value;

            const second = await firstQuery.filter(startAtValue(docToStartAtValue)).getDocs();
            expect(second.docs.length).toBe(limitCount - indexToStartAt);
            expect(second.docs[0].id).toBe(docToStartAt.id);
          });
        });

        describe('startAfter', () => {
          it('should return values starting after the specified startAt point.', async () => {
            const limitCount = 3;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const startAfterDoc = first.docs[1];
            const expectedFirstDoc = first.docs[2];

            const second = await firstQuery.filter(startAfter(startAfterDoc)).getDocs();
            expect(second.docs.length).toBe(limitCount);
            expect(second.docs[0].id).toBe(expectedFirstDoc.id);
          });
        });

        describe('endAt', () => {
          it('should return values ending with the specified endAt point (inclusive).', async () => {
            const limitCount = 2;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const second = await firstQuery.filter(endAt(first.docs[0])).getDocs();
            expect(second.docs.length).toBe(limitCount - 1);
            expect(second.docs[0].id).toBe(first.docs[0].id);
          });
        });

        describe('endAtValue', () => {
          it('should return values starting from the specified startAt path.', async () => {
            const limitCount = testDocumentCount;

            const firstQuery = query(orderBy<MockItem>('value'), limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const indexToEndAt = 2;
            const docToEndAt = first.docs[indexToEndAt];
            const docToEndAtValue = docToEndAt.data().value;

            const second = await firstQuery.filter(endAtValue(docToEndAtValue)).getDocs();
            expect(second.docs.length).toBe(indexToEndAt + 1);
            expect(second.docs[second.docs.length - 1].id).toBe(docToEndAt.id);
          });
        });

        describe('endBefore', () => {
          it('should return values ending with the specified endBefore point (exclusive).', async () => {
            const limitCount = 2;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const second = await firstQuery.filter(endBefore(first.docs[1])).getDocs();
            expect(second.docs.length).toBe(limitCount - 1);
            expect(second.docs[0].id).toBe(first.docs[0].id);
          });
        });
      });
    });
  });
}
