import { SubscriptionObject } from '../subscription';
import { map, Observable, shareReplay, skipWhile, distinctUntilChanged, filter } from 'rxjs';
import { distinctUntilArrayLengthChanges, scanBuildArray, filterMaybe, scanIntoArray } from "../rxjs";
import { lastValue, filterMaybeValues, Destroyable, Maybe } from "@dereekb/util";
import { ItemIteration, PageItemIteration } from "./iteration";
import { LoadingState, loadingStateHasError } from '../loading';

/**
 * An object that accumulates and exposes values from an ItemIteration.
 */
export interface ItemAccumulator<O, I = any, N extends ItemIteration<I> = ItemIteration<I>> {

  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;

  /**
   * Returns all items loaded so far in the iteration in a single array.
   */
  readonly allItems$: Observable<O[]>;

}

/**
 * An object that accumulates and exposes values from a PageItemIteration.
 */
export type PageItemAccumulator<O, I = any, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemAccumulator<O, I, N>;

/**
 * An accumulator with no mapping.
 */
export type MonotypeItemAccumulator<I, N extends ItemIteration<I> = ItemIteration<I>> = ItemAccumulator<I, I, N>;

/**
 * A page accumulator with no mapping.
 */
export type MonotypePageItemAccumulator<I, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemAccumulator<I, I, N>;


export type ItemAccumulatorMapFunction<O, I> = ((item: I) => Maybe<O>) | ((item: I, state: LoadingState<I>) => Maybe<O>);

/**
 * ItemAccumulator implementation.
 */
export class ItemAccumulatorInstance<O, I = any, N extends ItemIteration<I> = ItemIteration<I>> implements ItemAccumulator<O, I, N>, Destroyable {

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
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  readonly successfulLoadCount$: Observable<number> = this.allSuccessfulStates$.pipe(
    map(x => x.length),
    shareReplay(1)
  );

  // MARK: ItemAccumulator
  readonly allItems$: Observable<O[]> = this.allSuccessfulStates$.pipe(
    scanBuildArray((allSuccessfulStates) => {
      const mapStateToItem: (state: LoadingState<I>) => Maybe<O> = (state) => {
        let result: Maybe<O>;

        if (state.value != null) {
          result = this.mapItemFunction(state.value, state);
        }

        return result;
      };

      /* 
      Start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
      and subscription to allItems may not have started at the same time.

      We use scan to add in all models coming in afterwards by pushing them into the accumulator.
      This is to prevent performance issues with very large iteration sets, since we can
      append onto the array, rather than concat/copy the array each time.
      */
      const allPageResultsUpToFirstSubscription = allSuccessfulStates;
      const firstLatestState = lastValue(allPageResultsUpToFirstSubscription);
      const seed: O[] = filterMaybeValues(allPageResultsUpToFirstSubscription.map(mapStateToItem));

      const accumulatorObs: Observable<O> = this.latestSuccessfulState$.pipe(
        skipWhile(x => x === firstLatestState),
        map(mapStateToItem),
        filterMaybe()
      );

      return {
        seed,
        accumulatorObs
      };
    })
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
export function itemAccumulator<I, N extends ItemIteration<I>>(itemIteration: N): ItemAccumulatorInstance<I, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I>>(itemIteration: N, mapItem?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N>;
export function itemAccumulator<O, I, N extends ItemIteration<I>>(itemIteration: N, mapItemFunction?: ItemAccumulatorMapFunction<O, I>): ItemAccumulatorInstance<O, I, N> {
  if (!mapItemFunction) {
    mapItemFunction = (a: any) => a;
  }

  return new ItemAccumulatorInstance<O, I, N>(itemIteration, mapItemFunction);
}
