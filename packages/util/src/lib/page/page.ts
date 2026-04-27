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

/**
 * Numeric page identifier.
 *
 * @semanticType
 * @semanticTopic numeric
 * @semanticTopic reference
 * @semanticTopic dereekb-util:pagination
 */
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
/**
 * Extracts the page number from a {@link Page} object, returning {@link UNLOADED_PAGE} if the input is nullish.
 *
 * @param page - Page object to read from
 * @returns The page number, or {@link UNLOADED_PAGE} (-1) if not provided
 */
export function getPageNumber(page: Maybe<Partial<Page>>): number {
  return page?.page ?? UNLOADED_PAGE;
}

/**
 * Returns the next sequential page number after the given page.
 *
 * @param page - Current page object
 * @returns The current page number plus one
 */
export function getNextPageNumber(page: Maybe<Partial<Page>>): number {
  return getPageNumber(page) + 1;
}

/**
 * Checks whether the given page represents the final page of results.
 *
 * @param page - Page object to check
 * @returns `true` if the page number equals {@link FINAL_PAGE}
 */
export function isFinalPage(page: Maybe<Partial<Page>>): boolean {
  return page?.page === FINAL_PAGE;
}
