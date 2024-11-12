import { flattenAccumulatorResultItemArray, accumulatorCurrentPageListLoadingState, iteratorNextPageUntilPage, isLoadingStateFinishedLoading, SubscriptionObject, accumulatorFlattenPageListLoadingState } from '@dereekb/rxjs';
import { QueryDocumentSnapshot, makeDocuments, FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance, firebaseQueryItemAccumulator, FirebaseQueryItemAccumulator, firebaseQuerySnapshotAccumulator, FirebaseQuerySnapshotAccumulator } from '@dereekb/firebase';
import { filter, first, from, switchMap } from 'rxjs';
import { mockItemWithValue, MockItemCollectionFixture, MockItemDocument, MockItem } from '../mock';
import { arrayContainsDuplicateValue } from '@dereekb/util';

jest.setTimeout(9000);

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
          sub.subscription = iteration.currentState$.pipe(filter((x) => Boolean(x.value))).subscribe((currentState) => {
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

            sub.subscription = nextPageResult.pipe(switchMap((x) => iteration.currentState$)).subscribe((latestState) => {
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
        let accumulatorSub: SubscriptionObject;

        beforeEach(() => {
          accumulatorSub = new SubscriptionObject();
        });

        afterEach(() => {
          accumulatorSub.destroy();
        });

        describe('firebaseQuerySnapshotAccumulator()', () => {
          let accumulator: FirebaseQuerySnapshotAccumulator<MockItem>;

          beforeEach(() => {
            accumulator = firebaseQuerySnapshotAccumulator(iteration);
          });

          it('should accumulate values from the query.', () => {
            // todo
          });

          describe('flattenAccumulatorResultItemArray()', () => {
            it(`should aggregate the array of results into a single array.`, (done) => {
              const pagesToLoad = 2;

              // load up to page 2
              iteratorNextPageUntilPage(iteration, pagesToLoad).then((page) => {
                expect(page).toBe(pagesToLoad - 1);

                const obs = flattenAccumulatorResultItemArray(accumulator);

                accumulatorSub.subscription = obs.pipe(first()).subscribe((values) => {
                  expect(values.length).toBe(pagesToLoad * limit);
                  expect(arrayContainsDuplicateValue(values.map((x) => x.id))).toBe(false);

                  // should not be a query snapshot
                  expect(values[0].ref).toBeDefined();

                  done();
                });
              });
            });
          });

          describe('accumulatorCurrentPageListLoadingState()', () => {
            it('should return a loading state for the current page.', (done) => {
              const obs = accumulatorCurrentPageListLoadingState(accumulator);

              accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                const value = state.value;

                expect(isLoadingStateFinishedLoading(state)).toBe(true);
                expect(value).toBeDefined();
                expect(Array.isArray(value)).toBe(true);
                expect(Array.isArray(value![0])).toBe(true);

                done();
              });
            });
          });
        });

        describe('firebaseQueryItemAccumulator()', () => {
          let itemAccumulator: FirebaseQueryItemAccumulator<MockItem>;

          beforeEach(() => {
            itemAccumulator = firebaseQueryItemAccumulator(iteration);
          });

          describe('flattenAccumulatorResultItemArray()', () => {
            it(`should aggregate the array of results into a single array.`, (done) => {
              const pagesToLoad = 2;

              // load up to page 2
              iteratorNextPageUntilPage(iteration, pagesToLoad).then((page) => {
                expect(page).toBe(pagesToLoad - 1);

                const obs = flattenAccumulatorResultItemArray(itemAccumulator);

                accumulatorSub.subscription = obs.pipe(first()).subscribe((values) => {
                  expect(values.length).toBe(pagesToLoad * limit);
                  expect(arrayContainsDuplicateValue(values.map((x) => x.id))).toBe(false);
                  done();
                });
              });
            });
          });

          describe('flattenAccumulatorResultItemArray()', () => {
            it(`should aggregate the array of results into a single array of the items.`, (done) => {
              const pagesToLoad = 2;

              // load up to page 2
              iteratorNextPageUntilPage(iteration, pagesToLoad).then((page) => {
                expect(page).toBe(pagesToLoad - 1);

                const obs = flattenAccumulatorResultItemArray(itemAccumulator);

                accumulatorSub.subscription = obs.pipe(first()).subscribe((values) => {
                  expect(values.length).toBe(pagesToLoad * limit);
                  expect(arrayContainsDuplicateValue(values.map((x) => x.id))).toBe(false);

                  // should not be a query snapshot
                  expect((values[0] as unknown as QueryDocumentSnapshot<MockItem>).ref).not.toBeDefined();

                  done();
                });
              });
            });
          });

          describe('accumulatorFlattenPageListLoadingState()', () => {
            it('should return a loading state for the current page with all items in a single array.', (done) => {
              const obs = accumulatorFlattenPageListLoadingState(itemAccumulator);

              accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                const value = state.value;

                expect(isLoadingStateFinishedLoading(state)).toBe(true);
                expect(value).toBeDefined();
                expect(Array.isArray(value)).toBe(true);
                expect(Array.isArray(value![0])).toBe(false);

                done();
              });
            });
          });

          describe('accumulatorCurrentPageListLoadingState()', () => {
            it('should return a loading state for the current page.', (done) => {
              const obs = accumulatorCurrentPageListLoadingState(itemAccumulator);

              accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                const value = state.value;

                expect(isLoadingStateFinishedLoading(state)).toBe(true);
                expect(value).toBeDefined();
                expect(Array.isArray(value)).toBe(true);
                expect(Array.isArray(value![0])).toBe(true);

                done();
              });
            });
          });
        });
      });
    });
  });
}
