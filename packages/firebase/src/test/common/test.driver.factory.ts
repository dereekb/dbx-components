import { limit, orderBy, startAfter, startAt, where } from "../../lib";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { FirestoreCollectionQueryFactoryFunction } from "../../lib/common/firestore/query/query";
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

      let query: FirestoreCollectionQueryFactoryFunction<MockItem>;
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

      describe('constraint', () => {

        describe('limit', () => {

          it('should limit the number of items returned.', async () => {
            const limitCount = 2;

            const unlimited = await query().getDocs();
            expect(unlimited.docs.length).toBe(testDocumentCount);

            const result = await query(limit(limitCount)).getDocs();
            expect(result.docs.length).toBe(limitCount);
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

        describe('orderBy', () => {

          it('should return values sorted in ascending order.', async () => {
            const results = await query(orderBy('value', 'asc')).getDocs();
            expect(results.docs[0].data().value).toBe('0');
          });

          it('should return values sorted in descending order.', async () => {
            const results = await query(orderBy('value', 'desc')).getDocs();
            expect(results.docs[0].data().value).toBe(`${ items.length - 1 }`);
          });

        });

      });

    });

  });

}
