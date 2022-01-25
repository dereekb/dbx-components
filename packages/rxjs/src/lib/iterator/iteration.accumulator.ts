import { SubscriptionObject } from '@dereekb/rxjs';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { distinctUntilArrayLengthChanges, scanBuildArray, filterMaybe, scanIntoArray } from "../rxjs";
import { lastValue, filterMaybeValues, Destroyable } from "@dereekb/util";
import { map, Observable, shareReplay, skipWhile } from "rxjs";
import { ItemIteration, PageItemIteration } from "./iteration";
import { LoadingState, loadingStateHasError } from '../loading';

/**
 * An item iteration that exposes all accumulated values.
 */
export interface ItemIterationAccumulator<V> {

  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: ItemIteration<V>;

  /**
   * Returns all items loaded so far in the iteration in a single array.
   */
  readonly allItems$: Observable<V[]>;

}

/**
 * An item iteration that exposes all accumulated values.
 */
export interface PageItemIterationAccumulator<V> extends ItemIterationAccumulator<V> {

  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: PageItemIteration<V>;

}

export class ItemIterationAccumulatorInstance<V, I extends ItemIteration<V> = ItemIteration<V>> implements ItemIterationAccumulator<V>, Destroyable {

  constructor(readonly itemIteration: I) { }

  readonly latestSuccessfulState$: Observable<LoadingState<V>> = this.itemIteration.latestState$.pipe(
    filter(x => !loadingStateHasError(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * All successful page results in a single array.
   */
  readonly allSuccessfulStates$: Observable<LoadingState<V>[]> = this.latestSuccessfulState$.pipe(
    scanIntoArray({ immutable: false }),
    distinctUntilArrayLengthChanges(),
    shareReplay(1)
  );

  readonly successfulLoadCount$: Observable<number> = this.allSuccessfulStates$.pipe(
    map(x => x.length),
    shareReplay(1)
  );

  readonly allItems$: Observable<V[]> = this.allSuccessfulStates$.pipe(
    scanBuildArray((allSuccessfulStates) => {
      /* 
      We start with allSuccessfulPageResults$ since it contains all page results since the start of the iterator,
      and subscription to allItems may not have started at the same time.

      We use scan to add in all models coming in afterwards by pushing them into the accumulator.
      This is to prevent performance issues with very large iteration sets, since we can
      append onto the array, rather than concat/copy the array each time.
      */
      const allPageResultsUpToFirstSubscription = allSuccessfulStates;
      const firstLatestState = lastValue(allPageResultsUpToFirstSubscription);
      const seed: V[] = filterMaybeValues(allPageResultsUpToFirstSubscription.map(x => x.model));

      const accumulatorObs: Observable<V> = this.latestSuccessfulState$.pipe(
        skipWhile(x => x === firstLatestState),
        map(x => x.model),
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

export class PageItemIterationAccumulatorInstance<V, I extends PageItemIteration<V> = PageItemIteration<V>> extends ItemIterationAccumulatorInstance<V, I> implements PageItemIterationAccumulator<V>, Destroyable { }
