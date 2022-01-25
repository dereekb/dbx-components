import { LoadingState, mapLoadingStateResults, MapLoadingStateResultsConfiguration, PageLoadingState } from '../loading';
import { Destroyable } from "@dereekb/util";
import { map, Observable, shareReplay } from "rxjs";
import { ItemIteration, ItemIteratorNextRequest } from "./iteration";

/**
 * An object that maps loading states from one mapping to another.
 */
export interface MappedItemIteration<
  O,
  I = any,
  M extends LoadingState<O> = LoadingState<O>,
  L extends LoadingState<I> = LoadingState<I>,
  N extends ItemIteration<I, L> = ItemIteration<I, L>,
  >
  extends ItemIteration<O, M> {

  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;

}

export interface MappedItemIterationInstanceMapConfig<
  O,
  I,
  M extends LoadingState<O> = PageLoadingState<O>,
  L extends LoadingState<I> = PageLoadingState<I>
  > extends MapLoadingStateResultsConfiguration<I, O, L, M> {

  /**
   * Whether or not to forward the destroy() call to the base itemIteration.
   */
  forwardDestroy?: boolean;

}

export class MappedItemIterationInstance<
  O,
  I = any,
  M extends LoadingState<O> = LoadingState<O>,
  L extends LoadingState<I> = LoadingState<I>,
  N extends ItemIteration<I, L> = ItemIteration<I, L>
  > implements ItemIteration<O>, Destroyable {

  constructor(readonly itemIterator: N, readonly config: MappedItemIterationInstanceMapConfig<O, I, M, L>) { }

  readonly hasNext$: Observable<boolean> = this.itemIterator.hasNext$;
  readonly canLoadMore$: Observable<boolean> = this.itemIterator.canLoadMore$;

  readonly latestState$: Observable<M> = this.itemIterator.latestState$.pipe(
    map(state => mapLoadingStateResults(state, this.config)),
    shareReplay(1)
  );

  readonly currentState$: Observable<M> = this.itemIterator.currentState$.pipe(
    map(state => mapLoadingStateResults<I, O, L, M>(state, this.config)),
    shareReplay(1)
  );

  next(request?: ItemIteratorNextRequest): void {
    return this.itemIterator.next(request);
  }

  destroy() {
    if (this.config.forwardDestroy !== false) {
      this.itemIterator.destroy();
    }
  }

}

/**
 * Creates a new MappedItemIteration instance given the input ItemIteration and config.
 * 
 * @param itemIteration 
 * @param config 
 * @returns 
 */
export function mapItemIteration<
  O,
  I = any,
  M extends LoadingState<O> = LoadingState<O>,
  L extends LoadingState<I> = LoadingState<I>,
  N extends ItemIteration<I, L> = ItemIteration<I, L>
>(itemIteration: N, config: MappedItemIterationInstanceMapConfig<O, I, M, L>): MappedItemIterationInstance<O, I, M, L, N> {
  return new MappedItemIterationInstance<O, I, M, L, N>(itemIteration, config);
}
