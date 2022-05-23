import { SubscriptionObject } from '../subscription';
import { startWith, map, Observable, shareReplay, skipWhile, distinctUntilChanged, filter } from 'rxjs';
import { distinctUntilArrayLengthChanges, scanBuildArray, scanIntoArray } from "../rxjs";
import { MapFunctionOutputPair, lastValue, Destroyable, mapFunctionOutputPair, isMaybeSo } from "@dereekb/util";
import { ItemIteration, PageItemIteration } from "./iteration";
import { LoadingState, loadingStateHasError, mapLoadingStateValueFunction, MapLoadingStateValueMapFunction } from '../loading';

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
  readonly allItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]>;

  /**
   * Returns all items loaded so far in the iteration in a single array.
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
export type ItemAccumulatorValuePair<O, I = unknown> = MapFunctionOutputPair<O, LoadingState<I>>;

/**
 * ItemAccumulator implementation.
 */
export class ItemAccumulatorInstance<O, I = unknown, N extends ItemIteration<I> = ItemIteration<I>> implements ItemAccumulator<O, I, N>, Destroyable {

  constructor(readonly itemIteration: N, readonly mapItemFunction: ItemAccumulatorMapFunction<O, I>) { }

  readonly latestSuccessfulState$: Observable<LoadingState<I>> = this.itemIteration.latestState$.pipe(
    filter(x => !loadingStateHasError(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * All successful page results in a single array.
   */
  readonly allSuccessfulStates$: Observable<LoadingState<I>[]> = this.latestSuccessfulState$.pipe(
    scanIntoArray({ immutable: false }),
    /**
     * Don't wait for the first successful state in order to avoid never returning a value on immediate failures.
     */
    startWith([] as LoadingState<I>[]),
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  readonly successfulLoadCount$: Observable<number> = this.allSuccessfulStates$.pipe(
    map(x => x.length),
    shareReplay(1)
  );

  // MARK: ItemAccumulator
  readonly allItemPairs$: Observable<ItemAccumulatorValuePair<O, I>[]> = this.allSuccessfulStates$.pipe(
    scanBuildArray((allSuccessfulStates) => {
      const mapStateToItem = mapFunctionOutputPair(mapLoadingStateValueFunction(this.mapItemFunction));

      /* 
      Start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
      and subscription to allItems may not have started at the same time.

      We use scan to add in all models coming in afterwards by pushing them into the accumulator.
      This is to prevent performance issues with very large iteration sets, since we can
      append onto the array, rather than concat/copy the array each time.
      */
      const allPageResultsUpToFirstSubscription = allSuccessfulStates;
      const firstLatestState = lastValue(allPageResultsUpToFirstSubscription);
      const seed = allPageResultsUpToFirstSubscription.map(mapStateToItem).filter(x => isMaybeSo(x.output)) as ItemAccumulatorValuePair<O, I>[];

      const accumulatorObs = this.latestSuccessfulState$.pipe(
        skipWhile(x => x === firstLatestState),
        map(mapStateToItem),
        filter(x => isMaybeSo(x.output))
      ) as Observable<ItemAccumulatorValuePair<O, I>>;

      return {
        seed,
        accumulatorObs
      };
    }),
    shareReplay(1)
  );

  readonly allItems$: Observable<O[]> = this.allItemPairs$.pipe(
    map(x => x.map(y => y.output)),
    shareReplay(1)
  );

  private _sub = new SubscriptionObject(this.allSuccessfulStates$.subscribe());

  destroy() {
    this._sub.destroy();
  }

}

/**
 * Creates a new ItemAccumulator instance give the input ItemIteration.
 * 
 * @param itemIteration
 * @param mapItem 
 * @returns 
 */
export function itemAccumulator<I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N): ItemAccumulatorInstance<I, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N, mapItem?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I> = ItemIteration<I>>(itemIteration: N, mapItem?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N> {
  if (!mapItem) {
    mapItem = ((a: I) => a as unknown as O);
  }

  return new ItemAccumulatorInstance<O, I, N>(itemIteration, mapItem);
}
