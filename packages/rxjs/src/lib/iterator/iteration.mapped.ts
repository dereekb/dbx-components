import { type LoadingState, mapLoadingStateResults, type MapLoadingStateResultsConfiguration, type PageLoadingState } from '../loading';
import { type Destroyable } from '@dereekb/util';
import { map, type Observable, shareReplay } from 'rxjs';
import { type ItemIteration, type ItemIteratorNextRequest } from './iteration';

/**
 * An {@link ItemIteration} wrapper that transforms loading state values from one type to another
 * while preserving the iteration interface.
 */
export interface MappedItemIteration<O, I = unknown, M extends LoadingState<O> = LoadingState<O>, L extends LoadingState<I> = LoadingState<I>, N extends ItemIteration<I, L> = ItemIteration<I, L>> extends ItemIteration<O, M> {
  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;
}

/**
 * Configuration for creating a {@link MappedItemIterationInstance}, extending the loading state
 * mapping configuration with lifecycle options.
 */
export interface MappedItemIterationInstanceMapConfig<O, I, M extends LoadingState<O> = PageLoadingState<O>, L extends LoadingState<I> = PageLoadingState<I>> extends MapLoadingStateResultsConfiguration<I, O, L, M> {
  /**
   * Whether destroying the mapped instance also destroys the underlying iteration.
   * Defaults to `true`.
   */
  forwardDestroy?: boolean;
}

/**
 * Concrete instance of a mapped item iteration, exposing the transformed state observables
 * and the underlying iterator and configuration.
 */
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
 * Creates a {@link MappedItemIterationInstance} that wraps an existing iteration and transforms
 * its loading state values through the provided mapping configuration.
 *
 * Control flow (next, hasNext, canLoadMore) is delegated directly to the underlying iteration.
 *
 * @param itemIterator - the source iteration to wrap
 * @param config - mapping configuration for transforming loading state values
 * @returns mapped iteration instance with transformed state observables
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
