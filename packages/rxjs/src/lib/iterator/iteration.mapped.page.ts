import { type PageLoadingState } from '../loading';
import { type Observable } from 'rxjs';
import { type ItemIteratorNextRequest, type PageItemIteration } from './iteration';
import { type MappedItemIteration, MappedItemIterationInstance, type MappedItemIterationInstanceMapConfig, mapItemIteration } from './iteration.mapped';
import { type Maybe } from '@dereekb/util';

/**
 * MappedItemIteration for PageItemIteration
 */
export type MappedPageItemIteration<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> = MappedItemIteration<O, I, M, L, N>;

/**
 * MappedItemIterationInstance extension that implements PageItemIteration.
 */
export interface MappedPageItemIterationInstance<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> extends MappedItemIterationInstance<O, I, M, L, N>, PageItemIteration<O, M> {}

/**
 * Creates a new MappedItemIteration instance given the input ItemIteration and config.
 *
 * @param itemIteration
 * @param config
 * @returns
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

// MARK: Compat
/**
 * @deprecated use mappedPageItemIteration instead.
 */
export const mapPageItemIteration = mappedPageItemIteration;
