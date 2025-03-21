import { type Maybe } from '../value/maybe.type';

/**
 * Page value used when no list items have been loaded.
 */
export const UNLOADED_PAGE = -1;

/**
 * The first page of results.
 */
export const FIRST_PAGE = 0;

/**
 * Page value used when there are no elements left to load.
 */
export const FINAL_PAGE = -2;

export type PageNumber = number;

/**
 * Represents a page number.
 */
export interface Page {
  /**
   * Current page number.
   */
  page: PageNumber;
}

// MARK: Utility
export function getPageNumber(page: Maybe<Partial<Page>>): number {
  return page?.page ?? UNLOADED_PAGE;
}

export function getNextPageNumber(page: Maybe<Partial<Page>>): number {
  return getPageNumber(page) + 1;
}

export function isFinalPage(page: Maybe<Partial<Page>>): boolean {
  return page?.page === FINAL_PAGE;
}
