import { limit } from "../../lib";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { FirestoreCollectionQueryFactoryFunction } from "../../lib/common/firestore/query/query";
import { MockItemDocument, MockItem } from "./firestore.mock.item";
import { MockItemCollectionFixture } from "./firestore.mock.item.fixture";

export function describeQueryDriverTests(f: MockItemCollectionFixture) {

  describe('driver', () => {

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

      });

    });

  });

}
