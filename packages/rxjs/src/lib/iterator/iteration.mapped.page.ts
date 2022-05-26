import { PageLoadingState } from '../loading';
import { Observable } from 'rxjs';
import { ItemIteratorNextRequest, PageItemIteration } from './iteration';
import { MappedItemIteration, MappedItemIterationInstance, MappedItemIterationInstanceMapConfig } from './iteration.mapped';
import { Maybe } from '@dereekb/util';

/**
 * MappedItemIteration for PageItemIteration
 */
export type MappedPageItemIteration<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> = MappedItemIteration<O, I, M, L, N>;

/**
 * MappedItemIterationInstance extension that implements PageItemIteration.
 */
export class MappedPageItemIterationInstance<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>> extends MappedItemIterationInstance<O, I, M, L, N> implements PageItemIteration<O, M> {
  // MARK: PageItemIteration
  get maxPageLoadLimit() {
    return this.itemIterator.maxPageLoadLimit;
  }

  set maxPageLoadLimit(maxPageLoadLimit: Maybe<number>) {
    this.itemIterator.maxPageLoadLimit = maxPageLoadLimit;
  }

  readonly latestLoadedPage$: Observable<number> = this.itemIterator.latestLoadedPage$;

  nextPage(request?: ItemIteratorNextRequest): Promise<number> {
    return this.itemIterator.nextPage(request);
  }
}

/**
 * Creates a new MappedItemIteration instance given the input ItemIteration and config.
 *
 * @param itemIteration
 * @param config
 * @returns
 */
export function mapPageItemIteration<O, I = unknown, M extends PageLoadingState<O> = PageLoadingState<O>, L extends PageLoadingState<I> = PageLoadingState<I>, N extends PageItemIteration<I, L> = PageItemIteration<I, L>>(itemIteration: N, config: MappedItemIterationInstanceMapConfig<O, I, M, L>): MappedPageItemIterationInstance<O, I, M, L, N> {
  return new MappedPageItemIterationInstance<O, I, M, L, N>(itemIteration, config);
}
