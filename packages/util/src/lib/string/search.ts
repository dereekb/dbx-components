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

export interface SearchStringFilterConfig<T> {
  /**
   * Reads the search value(s) from the input
   */
  readStrings: ReadKeyFunction<T, string> | ReadMultipleKeysFunction<T, string>;
  /**
   * (Optional) decision function factory for the input.
   *
   * Defaults to caseInsensitiveFilterByIndexOfDecisionFactory() if not defined.
   */
  decisionFactory?: SearchStringDecisionFunctionFactory;
}

export type SearchStringFilterFunctionConfigInput<T> = ReadKeyFunction<T, string> | ReadMultipleKeysFunction<T, string> | SearchStringFilterConfig<T>;

/**
 * Creates a SearchStringFilterFunction
 *
 * @param config
 * @returns
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
 * SearchStringDecisionFunctionFactory that searches for string matches using the input search term/filter text.
 *
 * @param filterText
 * @returns
 */
export const caseInsensitiveFilterByIndexOfDecisionFactory: SearchStringDecisionFunctionFactory = (filterText: string) => {
  const searchString = filterText.toLocaleLowerCase();
  return (string: string) => string.toLocaleLowerCase().indexOf(searchString) !== -1;
};
