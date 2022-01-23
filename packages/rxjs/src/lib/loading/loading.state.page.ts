import { FilteredPage, Page } from '@dereekb/util';
import { LoadingState } from './loading.state';

/**
 * LoadingState with a Page.
 */
export interface PageLoadingState<T> extends LoadingState<T>, Page { }

/**
 * PageLoadingState with a filter.
 */
export interface FilteredPageLoadingState<T, F> extends PageLoadingState<T>, FilteredPage<F> { }

/**
 * LoadingPageState that has an array of the model
 */
export interface PageListLoadingState<T> extends PageLoadingState<T[]> { }

/**
 * PageListLoadingState with a Filter.
 */
export interface FilteredPageListLoadingState<T, F> extends FilteredPageLoadingState<T[], F> { }
