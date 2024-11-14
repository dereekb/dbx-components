import { type LoadingState, mapLoadingStateResults, type MapLoadingStateResultsConfiguration, type PageLoadingState } from '../loading';
import { type Destroyable } from '@dereekb/util';
import { map, type Observable, shareReplay } from 'rxjs';
import { type ItemIteration, type ItemIteratorNextRequest } from './iteration';

/**
 * An object that maps loading states from one mapping to another.
 */
export interface MappedItemIteration<O, I = unknown, M extends LoadingState<O> = LoadingState<O>, L extends LoadingState<I> = LoadingState<I>, N extends ItemIteration<I, L> = ItemIteration<I, L>> extends ItemIteration<O, M> {
  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;
}

export interface MappedItemIterationInstanceMapConfig<O, I, M extends LoadingState<O> = PageLoadingState<O>, L extends LoadingState<I> = PageLoadingState<I>> extends MapLoadingStateResultsConfiguration<I, O, L, M> {
  /**
   * Whether or not to forward the destroy() call to the base itemIteration.
   */
  forwardDestroy?: boolean;
}

export interface MappedItemIterationInstance<O, I = unknown, M extends LoadingState<O> = LoadingState<O>, L extends LoadingState<I> = LoadingState<I>, N extends ItemIteration<I, L> = ItemIteration<I, L>> extends ItemIteration<O>, Destroyable {
  readonly itemIterator: N;
  readonly config: MappedItemIterationInstanceMapConfig<O, I, M, L>;

  readonly hasNext$: Observable<boolean>;
  readonly canLoadMore$: Observable<boolean>;

  readonly firstState$: Observable<M>;
  readonly latestState$: Observable<M>;
  readonly currentState$: Observable<M>;

  next(request?: ItemIteratorNextRequest): void;
}

/**
 * Creates a new MappedItemIteration instance given the input ItemIteration and config.
 *
 * @param itemIteration
 * @param config
 * @returns
 */
export function mapItemIteration<O, I = unknown, M extends LoadingState<O> = LoadingState<O>, L extends LoadingState<I> = LoadingState<I>, N extends ItemIteration<I, L> = ItemIteration<I, L>>(itemIterator: N, config: MappedItemIterationInstanceMapConfig<O, I, M, L>): MappedItemIterationInstance<O, I, M, L, N> {
  const hasNext$: Observable<boolean> = itemIterator.hasNext$;
  const canLoadMore$: Observable<boolean> = itemIterator.canLoadMore$;

  const firstState$: Observable<M> = itemIterator.firstState$.pipe(
    map((state) => mapLoadingStateResults(state, config)),
    shareReplay(1)
  );

  const latestState$: Observable<M> = itemIterator.latestState$.pipe(
    map((state) => mapLoadingStateResults(state, config)),
    shareReplay(1)
  );

  const currentState$: Observable<M> = itemIterator.currentState$.pipe(
    map((state) => mapLoadingStateResults<I, O, L, M>(state, config)),
    shareReplay(1)
  );

  function next(request?: ItemIteratorNextRequest): void {
    return itemIterator.next(request);
  }

  function destroy() {
    if (config.forwardDestroy !== false) {
      itemIterator.destroy();
    }
  }

  const result: MappedItemIterationInstance<O, I, M, L, N> = {
    itemIterator,
    config,

    hasNext$,
    canLoadMore$,

    firstState$,
    latestState$,
    currentState$,

    next,
    destroy
  };

  return result;
}
