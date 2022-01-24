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

  next(request?: ItemIteratorNextRequest): void;

}

/**
 * An ItemIteration that has pages.
 */
export interface PageItemIteration<V = any> extends ItemIteration<V> {

  /**
   * Current page load limit.
   */
  maxPageLoadLimit: PageNumber;

  /**
   * Returns the latest items.
   */
   readonly latestState$: Observable<PageLoadingState<V>>;

  /**
   * Current page state. Includes only values
   */
   readonly currentPageState$: Observable<PageLoadingState<V>>;

  /**
   * Returns the latest page that has been loaded.
   * 
   * This page can be different than currentPageState$.
   */
  readonly latestLoadedPage$: Observable<PageNumber>;

}
