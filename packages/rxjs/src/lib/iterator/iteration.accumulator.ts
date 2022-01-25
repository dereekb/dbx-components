import { SubscriptionObject } from '../subscription';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { distinctUntilArrayLengthChanges, scanBuildArray, filterMaybe, scanIntoArray } from "../rxjs";
import { lastValue, filterMaybeValues, Destroyable, filterMaybeValuesFn, Maybe } from "@dereekb/util";
import { map, Observable, shareReplay, skipWhile } from "rxjs";
import { ItemIteration, PageItemIteration } from "./iteration";
import { LoadingState, loadingStateHasError } from '../loading';

/**
 * An object that accumulates and exposes values from an ItemIteration.
 */
export interface ItemIterationAccumulator<I, O, N extends ItemIteration<I> = ItemIteration<I>> {

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
export type PageItemIterationAccumulator<I, O, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemIterationAccumulator<I, O, N>;

/**
 * An accumulator with no mapping.
 */
export type MonotypeItemIterationAccumulator<I, N extends ItemIteration<I> = ItemIteration<I>> = ItemIterationAccumulator<I, I, N>;

/**
 * A page accumulator with no mapping.
 */
export type MonotypePageItemIterationAccumulator<I, N extends PageItemIteration<I> = PageItemIteration<I>> = ItemIterationAccumulator<I, I, N>;


export type ItemIterationAccumulatorMapFunction<I, O> = ((item: I) => Maybe<O>) | ((item: I, state: LoadingState<I>) => Maybe<O>);

/**
 * ItemIterationAccumulator implementation.
 */
export class ItemIterationAccumulatorInstance<I, O, N extends ItemIteration<I> = ItemIteration<I>> implements ItemIterationAccumulator<I, O, N>, Destroyable {

  constructor(readonly itemIteration: N, readonly mapItem: ItemIterationAccumulatorMapFunction<I, O>) { }

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

  // MARK: ItemIterationAccumulator
  readonly allItems$: Observable<O[]> = this.allSuccessfulStates$.pipe(
    scanBuildArray((allSuccessfulStates) => {
      const mapStateToItem: (state: LoadingState<I>) => O = (state) => {
        let result: Maybe<O>;

        if (state.model != null) {
          result = this.mapItem(state.model, state);
        }

        return result;
      };

      /* 
      We start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
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
export function itemAccumulator<I, N extends ItemIteration<I>>(itemIteration: N): ItemIterationAccumulatorInstance<I, I, N>;
export function itemAccumulator<I, O, N extends ItemIteration<I>>(itemIteration: N, mapItem?: ItemIterationAccumulatorMapFunction<I, O>): ItemIterationAccumulatorInstance<I, O, N>;
export function itemAccumulator<I, O, N extends ItemIteration<I>>(itemIteration: N, mapItem?: ItemIterationAccumulatorMapFunction<I, O>): ItemIterationAccumulatorInstance<I, O, N> {
  if (!mapItem) {
    mapItem = (a) => a;
  }

  return new ItemIterationAccumulatorInstance<I, O, N>(itemIteration, mapItem);
}
