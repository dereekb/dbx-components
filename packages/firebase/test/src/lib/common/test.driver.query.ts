import { SubscriptionObject } from "@dereekb/rxjs";
import { filter, first, from, skip } from "rxjs";
import { limit, orderBy, startAfter, startAt, where, limitToLast, endAt, endBefore, makeDocuments, FirestoreQueryFactoryFunction } from "@dereekb/firebase";
import { MockItemDocument, MockItem } from "./firestore.mock.item";
import { MockItemCollectionFixture } from "./firestore.mock.item.fixture";

/**
 * Describes query driver tests, using a MockItemCollectionFixture.
 * 
 * @param f 
 */
export function describeQueryDriverTests(f: MockItemCollectionFixture) {

  describe('FirestoreQueryDriver', () => {

    describe('query', () => {

      const testDocumentCount = 5;

      let query: FirestoreQueryFactoryFunction<MockItem>;
      let items: MockItemDocument[];

      beforeEach(async () => {
        query = f.instance.firestoreCollection.query;
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

          sub.subscription = query().streamDocs().pipe(filter(x => x.docs.length > items.length)).subscribe((results) => {
            expect(results.docs.length).toBe(items.length + itemsToAdd);
            done();
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

          sub.subscription = query().streamDocs().pipe(skip(1)).subscribe((results) => {
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
          })

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

            from(resultObs).pipe(first()).subscribe((results) => {
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

            from(resultObs).pipe(first()).subscribe((results) => {
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

        describe('startAt', () => {

          it('should return values starting from the specified startAt point.', async () => {
            const limitCount = 2;

            const firstQuery = query(limit(limitCount));
            const first = await firstQuery.getDocs();
            expect(first.docs.length).toBe(limitCount);

            const second = await firstQuery.filter(startAt(first.docs[1])).getDocs();
            expect(second.docs.length).toBe(limitCount);
            expect(second.docs[0].id).toBe(first.docs[1].id);
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
