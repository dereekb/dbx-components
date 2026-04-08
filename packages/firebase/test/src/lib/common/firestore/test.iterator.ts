import { flattenAccumulatorResultItemArray, accumulatorCurrentPageListLoadingState, iteratorNextPageUntilPage, isLoadingStateFinishedLoading, SubscriptionObject, accumulatorFlattenPageListLoadingState } from '@dereekb/rxjs';
import { type QueryDocumentSnapshot, makeDocuments, type FirestoreItemPageIterationFactoryFunction, type FirestoreItemPageIterationInstance, firebaseQueryItemAccumulator, type FirebaseQueryItemAccumulator, firebaseQuerySnapshotAccumulator, type FirebaseQuerySnapshotAccumulator } from '@dereekb/firebase';
import { filter, first, from, switchMap } from 'rxjs';
import { mockItemWithValue, type MockItemCollectionFixture, type MockItemDocument, type MockItem } from '../mock';
import { arrayContainsDuplicateValue } from '@dereekb/util';
import { callbackTest } from '@dereekb/util/test';

/**
 * Registers a shared test suite that validates Firestore pagination and iteration behavior
 * (page-based queries, snapshot/item accumulators, and loading-state integration)
 * against a live or emulated Firestore instance.
 *
 * Tests cover {@link FirestoreItemPageIterationFactoryFunction}, {@link firebaseQuerySnapshotAccumulator},
 * {@link firebaseQueryItemAccumulator}, and related RxJS accumulator utilities.
 *
 * @param f - Fixture providing the mock item collection and parent context for the tests.
 */
export function describeFirestoreIterationTests(f: MockItemCollectionFixture) {
  describe('firestoreItemPageIteration', () => {
    const testDocumentCount = 10;

    let firestoreIteration: FirestoreItemPageIterationFactoryFunction<MockItem>;
    let items: MockItemDocument[];
    let sub: SubscriptionObject;

    beforeEach(async () => {
      firestoreIteration = f.instance.mockItemCollection.firestoreIteration;
      items = await makeDocuments(f.instance.mockItemCollection.documentAccessor(), {
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
        it(
          'should use the input limit for page size.',
          callbackTest((done) => {
            const limit = 4;

            const iteration = firestoreIteration({ limit });

            sub.subscription = iteration.latestState$.subscribe((x) => {
              const results = x.value!;
              expect(results.length).toBe(limit);
              done();
            });
          })
        );
      });

      describe('inferEndOfResultsFromPageSize', () => {
        describe('with inferEndOfResultsFromPageSize=true (default)', () => {
          it(
            'should mark the result as the end when fewer items are returned than the limit.',
            callbackTest((done) => {
              const limit = testDocumentCount + 5; // request more than exist

              const iteration = firestoreIteration({ limit });

              sub.subscription = iteration.latestState$.subscribe((x) => {
                expect(x.value).toBeDefined();
                expect(x.value!.length).toBe(testDocumentCount);
                expect(x.hasNextPage).toBe(false);
                done();
              });
            })
          );

          it(
            'should not mark the result as the end when the page is full.',
            callbackTest((done) => {
              const limit = 4;

              const iteration = firestoreIteration({ limit });

              sub.subscription = iteration.latestState$.subscribe((x) => {
                expect(x.value).toBeDefined();
                expect(x.value!.length).toBe(limit);
                expect(x.hasNextPage).toBe(true);
                done();
              });
            })
          );

          it(
            'should reach end when limit equals total document count.',
            callbackTest((done) => {
              const limit = testDocumentCount; // exactly matches item count

              const iteration = firestoreIteration({ limit });
              const accumulator = firebaseQuerySnapshotAccumulator(iteration);

              // First page should return all items but not yet know it's the end
              iteration.nextPage().then(() => {
                // Load the next page which should discover end via empty snapshot
                iteration.nextPage().then(() => {
                  sub.subscription = iteration.latestState$
                    .pipe(
                      filter((x) => isLoadingStateFinishedLoading(x)),
                      first()
                    )
                    .subscribe((state) => {
                      expect(state.hasNextPage).toBe(false);

                      // Verify all items loaded without duplicates
                      flattenAccumulatorResultItemArray(accumulator)
                        .pipe(first())
                        .subscribe((values) => {
                          expect(values.length).toBe(testDocumentCount);
                          expect(arrayContainsDuplicateValue(values.map((x) => x.id))).toBe(false);
                          done();
                        });
                    });
                });
              });
            })
          );

          it(
            'should reach end when loading all pages with limit as a divisor of total count.',
            callbackTest((done) => {
              const limit = 5; // divides evenly into testDocumentCount (10)
              const expectedPages = testDocumentCount / limit; // 2 full pages + 1 empty to discover end

              const iteration = firestoreIteration({ limit });
              const accumulator = firebaseQuerySnapshotAccumulator(iteration);

              // Load pages until the iterator reaches the end
              iteratorNextPageUntilPage(iteration, expectedPages + 1).then((page) => {
                sub.subscription = iteration.latestState$
                  .pipe(
                    filter((x) => isLoadingStateFinishedLoading(x)),
                    first()
                  )
                  .subscribe((state) => {
                    expect(state.hasNextPage).toBe(false);

                    // Verify all items loaded without duplicates
                    flattenAccumulatorResultItemArray(accumulator)
                      .pipe(first())
                      .subscribe((values) => {
                        expect(values.length).toBe(testDocumentCount);
                        expect(arrayContainsDuplicateValue(values.map((x) => x.id))).toBe(false);
                        done();
                      });
                  });
              });
            })
          );
        });

        describe('with inferEndOfResultsFromPageSize=false', () => {
          it(
            'should not mark the result as the end even when fewer items are returned than the limit.',
            callbackTest((done) => {
              const limit = testDocumentCount + 5; // request more than exist

              const iteration = firestoreIteration({ limit, inferEndOfResultsFromPageSize: false });

              sub.subscription = iteration.latestState$.subscribe((x) => {
                expect(x.value).toBeDefined();
                expect(x.value!.length).toBe(testDocumentCount);
                expect(x.hasNextPage).toBe(true); // does not infer end
                done();
              });
            })
          );
        });
      });

      describe('constraint', () => {
        it(
          'should use the constraints',
          callbackTest((done) => {
            const iteration = firestoreIteration({ constraints: mockItemWithValue('0') });

            sub.subscription = iteration.latestState$.subscribe((x) => {
              const results = x.value!;
              expect(results.length).toBe(1);
              expect(results[0].id).toBe(items[0].documentRef.id);
              done();
            });
          })
        );
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
        it(
          'should load the first state when subscribed to for the first time.',
          callbackTest((done) => {
            sub.subscription = iteration.latestState$.subscribe((latestState) => {
              const page = latestState.page;
              expect(page).toBe(0);

              const values = latestState.value!;
              expect(values.length).toBe(limit);
              done();
            });
          })
        );
      });

      describe('currentState$', () => {
        it(
          'should load the first items when subscribed to for the first time.',
          callbackTest((done) => {
            sub.subscription = iteration.currentState$.pipe(filter((x) => Boolean(x.value))).subscribe((currentState) => {
              const page = currentState.page;
              expect(page).toBe(0);

              const values = currentState.value!;
              expect(values.length).toBe(limit);
              done();
            });
          })
        );
      });

      describe('nextPage()', () => {
        it(
          'should load the next page and return when the page has finished loading.',
          callbackTest((done) => {
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
          })
        );
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
            it(
              `should aggregate the array of results into a single array.`,
              callbackTest((done) => {
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
              })
            );
          });

          describe('accumulatorCurrentPageListLoadingState()', () => {
            it(
              'should return a loading state for the current page.',
              callbackTest((done) => {
                const obs = accumulatorCurrentPageListLoadingState(accumulator);

                accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                  const value = state.value;

                  expect(isLoadingStateFinishedLoading(state)).toBe(true);
                  expect(value).toBeDefined();
                  expect(Array.isArray(value)).toBe(true);
                  expect(Array.isArray(value![0])).toBe(true);

                  done();
                });
              })
            );
          });
        });

        describe('firebaseQueryItemAccumulator()', () => {
          let itemAccumulator: FirebaseQueryItemAccumulator<MockItem>;

          beforeEach(() => {
            itemAccumulator = firebaseQueryItemAccumulator(iteration);
          });

          describe('flattenAccumulatorResultItemArray()', () => {
            it(
              `should aggregate the array of results into a single array.`,
              callbackTest((done) => {
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
              })
            );
          });

          describe('flattenAccumulatorResultItemArray()', () => {
            it(
              `should aggregate the array of results into a single array of the items.`,
              callbackTest((done) => {
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
              })
            );
          });

          describe('accumulatorFlattenPageListLoadingState()', () => {
            it(
              'should return a loading state for the current page with all items in a single array.',
              callbackTest((done) => {
                const obs = accumulatorFlattenPageListLoadingState(itemAccumulator);

                accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                  const value = state.value;

                  expect(isLoadingStateFinishedLoading(state)).toBe(true);
                  expect(value).toBeDefined();
                  expect(Array.isArray(value)).toBe(true);
                  expect(Array.isArray(value![0])).toBe(false);

                  done();
                });
              })
            );
          });

          describe('accumulatorCurrentPageListLoadingState()', () => {
            it(
              'should return a loading state for the current page.',
              callbackTest((done) => {
                const obs = accumulatorCurrentPageListLoadingState(itemAccumulator);

                accumulatorSub.subscription = obs.pipe(filter((x) => !x.loading)).subscribe((state) => {
                  const value = state.value;

                  expect(isLoadingStateFinishedLoading(state)).toBe(true);
                  expect(value).toBeDefined();
                  expect(Array.isArray(value)).toBe(true);
                  expect(Array.isArray(value![0])).toBe(true);

                  done();
                });
              })
            );
          });
        });
      });
    });
  });
}
