import { type Observable } from 'rxjs';
import { type Destroyable, type Maybe, type PageNumber } from '@dereekb/util';
import { type LoadingState, type PageLoadingState } from '../loading';

export interface ItemIteratorNextRequest {
  /**
   * The expected page to request.
   *
   * If provided, the page must equal the target page, otherwise the next is ignored.
   */
  page?: number;
  /**
   * Whether or not to retry loading the page.
   */
  retry?: boolean;
}

export interface ItemIteration<V = unknown, L extends LoadingState<V> = LoadingState<V>> extends Destroyable {
  /**
   * Whether or not there are more items to be loaded.
   *
   * This emits every time a page has finished loading.
   *
   * This will not return false when the max page limit has been reached.
   */
  readonly hasNext$: Observable<boolean>;

  /**
   * Whether or not more items can be loaded.
   *
   * Similar to hasNext$ but does not emit until the value changes.
   *
   * This returns false if the max page limit has been reached.
   */
  readonly canLoadMore$: Observable<boolean>;

  /**
   * The first stable state that has finished loading.
   */
  readonly firstState$: Observable<L>;

  /**
   * The latest stable state that has finished loading.
   */
  readonly latestState$: Observable<L>;

  /**
   * The "current" page state.
   */
  readonly currentState$: Observable<L>;

  /**
   * Triggers a loading of the next set of items.
   */
  next(request?: ItemIteratorNextRequest): void;
}

/**
 * An ItemIteration that has pages.
 */
export interface PageItemIteration<V = unknown, L extends PageLoadingState<V> = PageLoadingState<V>> extends ItemIteration<V, L> {
  /**
   * Returns the maximum number of pages allowed to be loaded.
   *
   * A page of 15 means that pages 0-14 can be loaded, but not page 15.
   *
   * If this value is unset, there is no limit to the number of pages that can be loaded.
   *
   * For most cases you should always have a maxPageLoadLimit set to avoid iterating too munknown unused items.
   */
  getMaxPageLoadLimit(): Maybe<PageNumber>;

  /**
   * Sets the maximum page load limit on the iteration.
   */
  setMaxPageLoadLimit(maxPageLoadLimit: Maybe<PageNumber>): void;

  /**
   * Attempts to loads the next page of results and returns a promise.
   *
   * The promise will return when the next action has completed, and returns the page number of the loaded page.
   *
   * If the page result ends in an error, this promise will throw that error.
   *
   * @param request
   */
  nextPage(request?: ItemIteratorNextRequest): Promise<PageNumber>;

  /**
   * Returns the latest page that has been fully loaded.
   *
   * This page can be different than the page returned in currentPageState$.
   */
  readonly latestLoadedPage$: Observable<PageNumber>;
}
