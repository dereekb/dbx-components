import { type ReadKeyFunction, type ReadMultipleKeysFunction } from '../key';
import { type DecisionFunctionFactory } from '../value/decision';

// MARK: Search Strings
/**
 * Decision function factory that is configured with search string values.
 */
export type SearchStringDecisionFunctionFactory = DecisionFunctionFactory<string, string>;

/**
 * Filters values by the input filter text.
 */
export type SearchStringFilterFunction<T> = (filterText: string, values: T[]) => T[];

/**
 * Configuration for creating a {@link SearchStringFilterFunction}.
 *
 * @template T - The type of values being filtered.
 */
export interface SearchStringFilterConfig<T> {
  /**
   * Reads the search value(s) from the input item to compare against the filter text.
   */
  readStrings: ReadKeyFunction<T, string> | ReadMultipleKeysFunction<T, string>;
  /**
   * Optional decision function factory for matching logic.
   *
   * Defaults to {@link caseInsensitiveFilterByIndexOfDecisionFactory} if not defined.
   */
  decisionFactory?: SearchStringDecisionFunctionFactory;
}

/**
 * Input for creating a {@link SearchStringFilterFunction}. Can be a read function directly or a full config object.
 *
 * @template T - The type of values being filtered.
 */
export type SearchStringFilterFunctionConfigInput<T> = ReadKeyFunction<T, string> | ReadMultipleKeysFunction<T, string> | SearchStringFilterConfig<T>;

/**
 * Creates a {@link SearchStringFilterFunction} that filters values based on whether their string representation matches the filter text.
 *
 * @param config - A read function or full configuration specifying how to extract and match search strings.
 * @returns A function that filters an array of values by a search/filter text string.
 */
export function searchStringFilterFunction<T>(config: SearchStringFilterFunctionConfigInput<T>): SearchStringFilterFunction<T> {
  const { readStrings, decisionFactory = caseInsensitiveFilterByIndexOfDecisionFactory } = typeof config === 'function' ? { readStrings: config } : config;

  return (filterText: string, values: T[]) => {
    const decision = decisionFactory(filterText);

    return values.filter((value: T) => {
      const searchResult = readStrings(value);
      let match = false;

      if (Array.isArray(searchResult)) {
        match = searchResult.findIndex(decision) !== -1;
      } else if (searchResult != null) {
        match = decision(searchResult);
      }

      return match;
    });
  };
}

/**
 * Default {@link SearchStringDecisionFunctionFactory} that performs case-insensitive substring matching using `indexOf`.
 *
 * @param filterText - The search term to match against.
 * @returns A decision function that returns `true` if the input string contains the filter text (case-insensitive).
 */
export const caseInsensitiveFilterByIndexOfDecisionFactory: SearchStringDecisionFunctionFactory = (filterText: string) => {
  const searchString = filterText.toLocaleLowerCase();
  return (string: string) => string.toLocaleLowerCase().indexOf(searchString) !== -1;
};
