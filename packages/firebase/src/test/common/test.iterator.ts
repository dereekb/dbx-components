import { flattenIterationResultItemArray, ItemAccumulator, iteratorNextPageUntilPage, SubscriptionObject } from "@dereekb/rxjs";
import { filter, first, from, switchMap } from "rxjs";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance } from "../../lib/common/firestore/query/iterator";
import { MockItemDocument, MockItem } from "./firestore.mock.item";
import { MockItemCollectionFixture } from "./firestore.mock.item.fixture";
import { mockItemWithValue } from "./firestore.mock.item.query";
import { itemAccumulator } from 'packages/rxjs/src/lib/iterator/iteration.accumulator';
import { arrayContainsDuplicateValue } from "@dereekb/util";

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 * 
 * @param f 
 */
export function describeFirestoreIterationTests(f: MockItemCollectionFixture) {

  describe('firestoreItemPageIteration', () => {

    const testDocumentCount = 10;

    let firestoreIteration: FirestoreItemPageIterationFactoryFunction<MockItem>;
    let items: MockItemDocument[];
    let sub: SubscriptionObject;

    beforeEach(async () => {
      firestoreIteration = f.instance.firestoreCollection.firestoreIteration;
      items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
        count: testDocumentCount,
        init: (i) => {
          return {
            value: `${i}`,
            test: true
          };
        }
      });
      sub = new SubscriptionObject();
    });

    afterEach(() => {
      sub.destroy();
    });

    describe('filter', () => {

      describe('limit', () => {

        it('should use the input limit for page size.', (done) => {
          const limit = 4;

          const iteration = firestoreIteration({ limit });

          sub.subscription = iteration.latestState$.subscribe((x) => {
            const results = x.value!;
            expect(results.length).toBe(limit);
            done();
          });
        });

      });

      describe('constraint', () => {

        it('should use the constraints', (done) => {
          const iteration = firestoreIteration({ constraints: mockItemWithValue('0') });

          sub.subscription = iteration.latestState$.subscribe((x) => {
            const results = x.value!;
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(items[0].documentRef.id);
            done();
          });
        });

      });

    });

    describe('pagination', () => {

      const limit = 4;
      let iteration: FirestoreItemPageIterationInstance<MockItem>;

      beforeEach(() => {
        iteration = firestoreIteration({ limit });
      });

      afterEach(() => {
        iteration.destroy();
      });

      describe('latestState$', () => {

        it('should load the first state when subscribed to for the first time.', (done) => {
          sub.subscription = iteration.latestState$.subscribe((latestState) => {
            const page = latestState.page;
            expect(page).toBe(0);

            const values = latestState.value!;
            expect(values.length).toBe(limit);
            done();
          });
        });

      });

      describe('currentState$', () => {

        it('should load the first items when subscribed to for the first time.', (done) => {
          sub.subscription = iteration.currentState$.pipe(filter(x => Boolean(x.value))).subscribe((currentState) => {
            const page = currentState.page;
            expect(page).toBe(0);

            const values = currentState.value!;
            expect(values.length).toBe(limit);
            done();
          });
        });

      });

      describe('nextPage()', () => {

        it('should load the next page and return when the page has finished loading.', (done) => {
          iteration.nextPage().then(() => {
            const nextPageResult = from(iteration.nextPage());

            sub.subscription = nextPageResult.pipe(switchMap(x => iteration.currentState$)).subscribe((latestState) => {
              const page = latestState.page;
              expect(page).toBe(1);

              const values = latestState.value!;
              expect(values.length).toBe(limit);
              done();
            });
          });
        });

      });

      describe('with accumulator', () => {

        let accumulator: ItemAccumulator<MockItemDocument[]>;

        beforeEach(() => {
          accumulator = itemAccumulator(iteration);
        });

        describe('flattenIterationResultItemArray()', () => {

          it(`should aggregate the array of results into a single array.`, (done) => {
            const pagesToLoad = 2;

            iteratorNextPageUntilPage(iteration, pagesToLoad).then((page) => {
              expect(page).toBe(pagesToLoad - 1);
      
              const obs = flattenIterationResultItemArray(accumulator);
      
              obs.pipe(first()).subscribe((values) => {
                expect(values.length).toBe(pagesToLoad * limit);
                expect(arrayContainsDuplicateValue(values.map(x => x.id))).toBe(false);
                done();
              });
      
            });
      
          });
      
        });
      
      });

    });

  });

}
