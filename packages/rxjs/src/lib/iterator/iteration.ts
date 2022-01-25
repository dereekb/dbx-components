import { Observable } from 'rxjs';
import { Destroyable, Maybe, PageNumber } from "@dereekb/util";
import { LoadingState, PageLoadingState } from '../loading';

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

export interface ItemIteration<V = any> extends Destroyable {

  readonly hasNext$: Observable<boolean>;
  readonly canLoadMore$: Observable<boolean>;

  /**
   * Returns the latest items.
   */
  readonly latestState$: Observable<LoadingState<Maybe<V>>>;

  /**
   * Returns all items loaded so far in the iteration in a single array.
   */
  readonly allItems$: Observable<V[]>;

  /**
   * Triggers a loading of the next page.
   */
  next(request?: ItemIteratorNextRequest): void;

}

/**
 * An ItemIteration that has pages.
 */
export interface PageItemIteration<V = any> extends ItemIteration<V> {

  /**
   * The maximum number of pages allowed to be loaded.
   * 
   * A page of 15 means that pages 0-14 can be loaded, but not page 15.
   */
  maxPageLoadLimit: PageNumber;

  /**
   * Attempts to loads the next page of results and returns a promise.
   * 
   * The promise will return when the next action has completed.
   * 
   * If the page result ends in an error, this promise will throw that error.
   * 
   * @param request 
   */
  nextPage(request?: ItemIteratorNextRequest): Promise<PageNumber>;

  /**
   * Returns the latest items.
   */
  readonly latestState$: Observable<PageLoadingState<V>>;

  /**
   * The "current" page state.
   */
  readonly currentPageState$: Observable<PageLoadingState<V>>;

  /**
   * Returns the latest page that has been fully loaded.
   * 
   * This page can be different than the page returned in currentPageState$.
   */
  readonly latestLoadedPage$: Observable<PageNumber>;

}
