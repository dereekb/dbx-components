import { type PageLoadingState } from '../loading';
import { type ItemIteratorNextRequest, type PageItemIteration } from './iteration';
import { type MappedItemIteration, type MappedItemIterationInstance, type MappedItemIterationInstanceMapConfig, mapItemIteration } from './iteration.mapped';
import { type Maybe } from '@dereekb/util';

/**
 * {@link MappedItemIteration} specialized for {@link PageItemIteration}, preserving page-specific loading state types.
 */
export type MappedPageItemIteration<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> = MappedItemIteration<O, I, M, L, N>;

/**
 * Instance of a mapped page iteration that implements both {@link MappedItemIterationInstance}
 * and {@link PageItemIteration}, providing transformed states alongside page-specific operations.
 */
export interface MappedPageItemIterationInstance<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> extends MappedItemIterationInstance<O, I, M, L, N>, PageItemIteration<O, M> {}

/**
 * Creates a {@link MappedPageItemIterationInstance} that wraps a {@link PageItemIteration}
 * and transforms its loading state values while preserving page-level operations
 * (nextPage, page load limits, latestLoadedPage).
 *
 * @param itemIteration - the source page iteration to wrap
 * @param config - mapping configuration for transforming loading state values
 * @returns mapped page iteration instance
 */
export function mappedPageItemIteration<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>>(itemIteration: N, config: MappedItemIterationInstanceMapConfig<O, I, M, L>): MappedPageItemIterationInstance<O, I, M, L, N> {
  function nextPage(request?: ItemIteratorNextRequest): Promise<number> {
    return itemIteration.nextPage(request);
  }

  return {
    ...mapItemIteration(itemIteration, config),
    latestLoadedPage$: itemIteration.latestLoadedPage$,

    getMaxPageLoadLimit(): Maybe<number> {
      return itemIteration.getMaxPageLoadLimit();
    },

    setMaxPageLoadLimit(maxPageLoadLimit: Maybe<number>): void {
      itemIteration.setMaxPageLoadLimit(maxPageLoadLimit);
    },

    nextPage
  };
}
