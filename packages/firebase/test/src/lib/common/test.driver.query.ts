import { SubscriptionObject } from '@dereekb/rxjs';
import { filter, first, from, skip } from 'rxjs';
import { limit, orderBy, startAfter, startAt, where, limitToLast, endAt, endBefore, makeDocuments, FirestoreQueryFactoryFunction, startAtValue, endAtValue, whereDocumentId } from '@dereekb/firebase';
import { MockItemDocument, MockItem, MockItemSubItemDocument, MockItemSubItem, MockItemDeepSubItemDocument, MockItemDeepSubItem } from './firestore.mock.item';
import { MockItemCollectionFixture } from './firestore.mock.item.fixture';
import { allChildMockItemDeepSubItemsWithinMockItem } from './firestore.mock.item.query';

/**
 * Describes query driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeQueryDriverTests(f: MockItemCollectionFixture) {
  describe('FirestoreQueryDriver', () => {
    const testDocumentCount = 5;

    let items: MockItemDocument[];

    beforeEach(async () => {
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

        let queryDeepSubItems: FirestoreQueryFactoryFunction<MockItemDeepSubItem>;

        let allDeepSubItems: MockItemDeepSubItemDocument[];

        beforeEach(async () => {
          queryDeepSubItems = f.instance.mockItemDeepSubItemCollectionGroup.query;
          deepSubItemParentA = allSubItems[0];

          const results = await Promise.all(
            allSubItems.map((parent: MockItemSubItemDocument) =>
              makeDocuments(f.instance.mockItemDeepSubItemCollection(parent).documentAccessor(), {
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
          const result = await queryDeepSubItems(allChildMockItemDeepSubItemsWithinMockItem(parentA.documentRef)).getDocs();
          expect(result.docs.length).toBe(totalDeepSubItemsPerMockItem);
          result.docs.forEach((x) => expect(x.ref.parent?.parent?.parent?.parent?.path).toBe(parentA.documentRef.path));
        });
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

          sub.subscription = query()
            .streamDocs()
            .pipe(skip(1))
            .subscribe((results) => {
              deleteSeen = true;
              expect(results.docs.length).toBe(items.length - itemsToRemove);
              tryComplete();
            });

          items[0].accessor.exists().then((exists) => {
            expect(exists).toBe(true);

            // remove one item
            return items[0].accessor.delete().then(() => {
              deleteCompleted = true;
              tryComplete();
            });
          });
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

          it('should fail if orderby is not provided.', async () => {
            const limitCount = 2;

            const unlimited = await query().getDocs();
            expect(unlimited.docs.length).toBe(testDocumentCount);

            try {
              await query(limitToLast(limitCount)).getDocs();
              fail();
            } catch (e) {
              expect(e).toBeDefined();
            }
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
          it('should return the documents matching the query.', async () => {
            const value = '0';

            const result = await query(where('value', '==', value)).getDocs();
            expect(result.docs.length).toBe(1);
            expect(result.docs[0].data().value).toBe(value);
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
