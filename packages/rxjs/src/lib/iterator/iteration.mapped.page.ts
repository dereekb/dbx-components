import { type PageLoadingState } from '../loading';
import { type ItemIteratorNextRequest, type PageItemIteration } from './iteration';
import { type MappedItemIteration, type MappedItemIterationInstance, type MappedItemIterationInstanceMapConfig, mapItemIteration } from './iteration.mapped';
import { type Maybe } from '@dereekb/util';

/**
 * {@link MappedItemIteration} specialized for {@link PageItemIteration}, preserving page-specific loading state types.
 */
export type MappedPageItemIteration<M extends PageLoadingState, L extends PageLoadingState, N extends PageItemIteration<L> = PageItemIteration<L>> = MappedItemIteration<M, L, N>;

/**
 * Instance of a mapped page iteration that implements both {@link MappedItemIterationInstance}
 * and {@link PageItemIteration}, providing transformed states alongside page-specific operations.
 */
export interface MappedPageItemIterationInstance<M extends PageLoadingState, L extends PageLoadingState, N extends PageItemIteration<L> = PageItemIteration<L>> extends MappedItemIterationInstance<M, L, N>, PageItemIteration<M> {}

/**
 * Creates a {@link MappedPageItemIterationInstance} that wraps a {@link PageItemIteration}
 * and transforms its loading state values while preserving page-level operations
 * (nextPage, page load limits, latestLoadedPage).
 *
 * @param itemIteration - The source page iteration to wrap.
 * @param config - Mapping configuration for transforming loading state values.
 * @returns Mapped page iteration instance.
 */
export function mappedPageItemIteration<M extends PageLoadingState, L extends PageLoadingState, N extends PageItemIteration<L> = PageItemIteration<L>>(itemIteration: N, config: MappedItemIterationInstanceMapConfig<L, M>): MappedPageItemIterationInstance<M, L, N> {
  function nextPage(request?: ItemIteratorNextRequest): Promise<number> {
    return itemIteration.nextPage(request);
  }

  return {
    ...mapItemIteration<M, L, N>(itemIteration, config),
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
