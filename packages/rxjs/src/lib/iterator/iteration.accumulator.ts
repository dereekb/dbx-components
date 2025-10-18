import { SubscriptionObject } from '../subscription';
import { startWith, map, shareReplay, skipWhile, distinctUntilChanged, filter, first, firstValueFrom, type Observable, switchMap, from } from 'rxjs';
import { distinctUntilArrayLengthChanges, scanBuildArray, scanIntoArray, switchMapWhileTrue, timeoutStartWith } from '../rxjs';
import { type MapFunctionOutputPair, lastValue, type Destroyable, mapFunctionOutputPair, isMaybeSo, type IndexRef, type GetterOrValue, asGetter, performTaskLoop, type MapFunction, type PromiseOrValue, asPromise, type PageNumber, type Page } from '@dereekb/util';
import { type ItemIteration, type PageItemIteration } from './iteration';
import { type LoadingState, isLoadingStateWithError, mapLoadingStateValueFunction, type MapLoadingStateValueMapFunction } from '../loading';
import { iterationHasNextAndCanLoadMore } from './iteration.next';

export type ItemAccumulatorMapFunction<O, I> = MapLoadingStateValueMapFunction<O, I>;

/**
 * An object that accumulates and exposes values from an ItemIteration.
 */
export interface ItemAccumulator<O, I = unknown, N extends ItemIteration<I> = ItemIteration<I>> {
  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;

  /**
   * Returns all items with their input pairs.
   */
  readonly currentAllItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]>;

  /**
   * Returns all items loaded so far in the iteration in a single array.
   */
  readonly currentAllItems$: Observable<O[]>;

  /**
   * Returns all items with their input pairs.
   *
   * The first emission occurs when/after the first value has been emitted.
   */
  readonly allItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]>;

  /**
   * Returns all items loaded so far in the iteration in a single array.
   *
   * The first emission occurs when/after the first value has been emitted.
   */
  readonly allItems$: Observable<O[]>;

  /**
   * The item mapping function for this accumulator.
   */
  mapItemFunction: ItemAccumulatorMapFunction<O, I>;
}

/**
 * An object that accumulates and exposes values from a PageItemIteration.
 */
export type PageItemAccumulator<O, I = unknown, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemAccumulator<O, I, N>;

/**
 * An accumulator with no mapping.
 */
export type MonotypeItemAccumulator<I, N extends ItemIteration<I> = ItemIteration<I>> = ItemAccumulator<I, I, N>;

/**
 * A page accumulator with no mapping.
 */
export type MonotypePageItemAccumulator<I, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemAccumulator<I, I, N>;

/**
 * Value of an item accumulator.
 */
export interface ItemAccumulatorValuePair<O, I = unknown> extends MapFunctionOutputPair<O, LoadingState<I>>, IndexRef {}

export interface ItemAccumulatorInstance<O, I = unknown, N extends ItemIteration<I> = ItemIteration<I>> extends ItemAccumulator<O, I, N>, Destroyable {
  readonly hasCompletedInitialLoad$: Observable<boolean>;
  readonly latestSuccessfulState$: Observable<LoadingState<I>>;
  /**
   * All successful page results in a single array.
   */
  readonly allSuccessfulStates$: Observable<LoadingState<I>[]>;
  readonly successfulLoadCount$: Observable<number>;
}

/**
 * Creates a new ItemAccumulatorInstance give the input ItemIteration and optional map function.
 *
 * @param itemIteration
 * @param mapItem
 * @returns
 */
export function itemAccumulator<I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N): ItemAccumulatorInstance<I, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N, mapItem?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N, inputMapItem?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N> {
  const mapItemFunction = inputMapItem ?? ((a: I) => a as unknown as O);

  const hasCompletedInitialLoad$: Observable<boolean> = itemIteration.firstState$.pipe(
    map(() => true),
    startWith(false),
    distinctUntilChanged(),
    shareReplay(1)
  );

  const latestSuccessfulState$: Observable<LoadingState<I>> = itemIteration.latestState$.pipe(
    filter((x) => !isLoadingStateWithError(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  const _allSuccessfulStates$: Observable<LoadingState<I>[]> = latestSuccessfulState$.pipe(
    scanIntoArray({ immutable: false }),
    /**
     * Don't wait for the first successful state in order to avoid never returning a value on immediate failures.
     */
    startWith([] as LoadingState<I>[]),
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  const allSuccessfulStates$: Observable<LoadingState<I>[]> = _allSuccessfulStates$.pipe(
    map((x) => [...x]), // return a copy of the array, and not the scanIntoArray() result that is mutable
    shareReplay(1)
  );

  const successfulLoadCount$: Observable<number> = _allSuccessfulStates$.pipe(
    map((x) => x.length),
    shareReplay(1)
  );

  // MARK: ItemAccumulator
  const currentAllItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]> = _allSuccessfulStates$.pipe(
    scanBuildArray((allSuccessfulStates) => {
      const mapStateToItem = mapFunctionOutputPair(mapLoadingStateValueFunction(mapItemFunction));

      /* 
      Start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
      and subscription to allItems may not have started at the same time.

      We use scan to add in all models coming in afterwards by pushing them into the accumulator.
      This is to prevent performance issues with very large iteration sets, since we can
      append onto the array, rather than concat/copy the array each time.
      */
      const allPageResultsUpToFirstSubscription = allSuccessfulStates;
      const firstLatestState = lastValue(allPageResultsUpToFirstSubscription);
      const seed = allPageResultsUpToFirstSubscription.map(mapStateToItem).filter((x) => isMaybeSo(x.output)) as ItemAccumulatorValuePair<O, I>[];

      const accumulatorObs = latestSuccessfulState$.pipe(
        skipWhile((x) => x === firstLatestState),
        map(mapStateToItem),
        filter((x) => isMaybeSo(x.output))
      ) as Observable<ItemAccumulatorValuePair<O, I>>;

      return {
        seed,
        accumulatorObs
      };
    }),
    shareReplay(1)
  );

  const currentAllItems$: Observable<O[]> = currentAllItemPairs$.pipe(
    map((x) => x.map((y) => y.output)),
    shareReplay(1)
  );

  const allItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]> = hasCompletedInitialLoad$.pipe(switchMapWhileTrue(currentAllItemPairs$), shareReplay(1));
  const allItems$: Observable<O[]> = hasCompletedInitialLoad$.pipe(switchMapWhileTrue(currentAllItems$), shareReplay(1));

  const sub = new SubscriptionObject(_allSuccessfulStates$.subscribe());
  const destroy = () => sub.destroy();

  const result: ItemAccumulatorInstance<O, I, N> = {
    itemIteration,
    mapItemFunction,
    hasCompletedInitialLoad$,
    latestSuccessfulState$,
    allSuccessfulStates$,
    successfulLoadCount$,
    currentAllItemPairs$,
    currentAllItems$,
    allItemPairs$,
    allItems$,
    destroy
  };

  return result;
}

// MARK: Utility
export type ItemAccumulatorNextPageUntilResultsCountFunction<O> = MapFunction<O[], PromiseOrValue<number>>;

export interface ItemAccumulatorNextPageUntilResultsCountConfig<O> {
  readonly accumulator: ItemAccumulator<O, any, PageItemIteration<any>>;
  readonly maxResultsLimit: GetterOrValue<number>;
  readonly countResultsFunction: ItemAccumulatorNextPageUntilResultsCountFunction<O>;
}

export interface ItemAccumulatorNextPageUntilResultsCountResult extends Page {
  readonly resultsCount: number;
}

/**
 * Automatically calls next on the accumulator's page item iteration up to the target number of results. Returns the total number of items loaded.
 *
 * The promise will reject with an error if an error is encountered.
 *
 * @param iteration
 * @param maxResultsLimit
 * @returns
 */
export function itemAccumulatorNextPageUntilResultsCount<O>(config: ItemAccumulatorNextPageUntilResultsCountConfig<O>): Promise<ItemAccumulatorNextPageUntilResultsCountResult> {
  const { accumulator, maxResultsLimit, countResultsFunction: countResults } = config;
  const getMaxResultsLimit = asGetter(maxResultsLimit);
  const canLoadMoreObs = iterationHasNextAndCanLoadMore(accumulator.itemIteration).pipe(
    timeoutStartWith(false, 100), // TODO: This can fail to emit anything if the iterator has been destroyed
    shareReplay(1)
  );

  async function checkResultsLimit() {
    const allItems = await firstValueFrom(accumulator.currentAllItems$);
    const canLoadMore = await firstValueFrom(canLoadMoreObs);

    const currentCount = await countResults(allItems);
    const maxResultsLimit = getMaxResultsLimit();
    const shouldContinue = canLoadMore && currentCount < maxResultsLimit;

    return {
      shouldContinue,
      currentCount
    };
  }

  return new Promise((resolve, reject) => {
    accumulator.currentAllItems$
      .pipe(
        first(),
        switchMap((allItems) => from(asPromise(countResults(allItems))))
      )
      .subscribe({
        next: async (currentResultsCount: number) => {
          performTaskLoop<PageNumber>({
            initValue: currentResultsCount,
            checkContinue: async (x, i) => {
              const result = await checkResultsLimit();
              currentResultsCount = result.currentCount;
              return result.shouldContinue;
            },
            next: async () => accumulator.itemIteration.nextPage()
          })
            .then((page) => {
              resolve({
                page,
                resultsCount: currentResultsCount
              });
            })
            .catch((error) => {
              reject(error);
              throw error;
            });
        },
        error: (error) => {
          reject(error);
        }
      });
  });
}
