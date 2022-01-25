import { Maybe } from "../value";

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
   * 
   * // TODO: Rename to pageNumber
   */
  page: PageNumber;

}

// MARK: Utility
export function getPageNumber(page: Maybe<Page>): number {
  return page?.page ?? UNLOADED_PAGE;
}

export function getNextPageNumber(page: Maybe<Page>): number {
  return (getPageNumber(page) + 1);
}

export function isFinalPage(page: Maybe<Page>): boolean {
  return page?.page === FINAL_PAGE;
}
