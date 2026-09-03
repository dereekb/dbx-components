import { type LoadingState, type LoadingStateValue, mapLoadingStateResults, type MapLoadingStateResultsConfiguration } from '../loading';
import { type Destroyable } from '@dereekb/util';
import { map, type Observable, shareReplay } from 'rxjs';
import { type ItemIteration, type ItemIteratorNextRequest } from './iteration';

/**
 * An {@link ItemIteration} wrapper that transforms loading state values from one type to another
 * while preserving the iteration interface.
 */
export interface MappedItemIteration<M extends LoadingState, L extends LoadingState, N extends ItemIteration<L> = ItemIteration<L>> extends ItemIteration<M> {
  /**
   * Iteration being accumulated.
   */
  readonly itemIteration: N;
}

/**
 * Configuration for creating a {@link MappedItemIterationInstance}, extending the loading state
 * mapping configuration with lifecycle options.
 */
export interface MappedItemIterationInstanceMapConfig<L extends LoadingState, M extends LoadingState> extends MapLoadingStateResultsConfiguration<L, LoadingStateValue<M>, M> {
  /**
   * Whether destroying the mapped instance also destroys the underlying iteration.
   * Defaults to `true`.
   */
  readonly forwardDestroy?: boolean;
}

/**
 * Concrete instance of a mapped item iteration, exposing the transformed state observables
 * and the underlying iterator and configuration.
 */
export interface MappedItemIterationInstance<M extends LoadingState, L extends LoadingState, N extends ItemIteration<L> = ItemIteration<L>> extends ItemIteration<M>, Destroyable {
  readonly itemIterator: N;
  readonly config: MappedItemIterationInstanceMapConfig<L, M>;

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
 * @param itemIterator - The source iteration to wrap.
 * @param config - Mapping configuration for transforming loading state values.
 * @returns Mapped iteration instance with transformed state observables.
 */
export function mapItemIteration<M extends LoadingState, L extends LoadingState, N extends ItemIteration<L> = ItemIteration<L>>(itemIterator: N, config: MappedItemIterationInstanceMapConfig<L, M>): MappedItemIterationInstance<M, L, N> {
  const hasNext$: Observable<boolean> = itemIterator.hasNext$;
  const canLoadMore$: Observable<boolean> = itemIterator.canLoadMore$;

  const firstState$: Observable<M> = itemIterator.firstState$.pipe(
    map((state) => mapLoadingStateResults<L, LoadingStateValue<M>, M>(state, config)),
    shareReplay(1)
  );

  const latestState$: Observable<M> = itemIterator.latestState$.pipe(
    map((state) => mapLoadingStateResults<L, LoadingStateValue<M>, M>(state, config)),
    shareReplay(1)
  );

  const currentState$: Observable<M> = itemIterator.currentState$.pipe(
    map((state) => mapLoadingStateResults<L, LoadingStateValue<M>, M>(state, config)),
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

  const result: MappedItemIterationInstance<M, L, N> = {
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
