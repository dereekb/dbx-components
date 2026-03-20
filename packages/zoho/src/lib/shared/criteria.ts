/* eslint-disable @typescript-eslint/no-explicit-any -- generic defaults use any for maximum flexibility */
import { type Maybe, type ArrayOrValue, filterMaybeArrayValues, asArray, type PrimativeKey, escapeStringCharactersFunction } from '@dereekb/util';

/**
 * Encoded criteria string used in Zoho search API query parameters.
 *
 * Format: `(field:filter:value)` entries joined by `and`/`or` operators.
 *
 * @example `(Last_Name:equals:Smith)and(Email:contains:example.com)`
 */
export type ZohoSearchRecordsCriteriaString = string;

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/crm/developer/docs/api/v8/search-records.html
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA = 10;

/**
 * Compiles a {@link ZohoSearchRecordsCriteriaTreeElement} into a URL-ready criteria string.
 *
 * Accepts any supported input shape: a raw criteria string (passed through),
 * an array of {@link ZohoSearchRecordsCriteriaEntry} (AND-joined), or a full
 * {@link ZohoSearchRecordsCriteriaTree} with nested AND/OR groups. Returns
 * `undefined` when the input is nullish or empty.
 *
 * @param input - Criteria tree element, entry array, or raw criteria string
 * @returns Compiled criteria string, or `undefined` if input is empty
 *
 * @example
 * ```typescript
 * // From an entry array (AND-joined):
 * const criteria = zohoSearchRecordsCriteriaString([
 *   { field: 'Last_Name', filter: 'equals', value: 'Smith' },
 *   { field: 'Email', filter: 'contains', value: 'example.com' }
 * ]);
 * // => '((Last_Name:equals:Smith)and(Email:contains:example.com))'
 *
 * // From a tree with OR:
 * const orCriteria = zohoSearchRecordsCriteriaString({
 *   or: [
 *     [{ field: 'Status', filter: 'equals', value: 'Active' }],
 *     [{ field: 'Status', filter: 'equals', value: 'Pending' }]
 *   ]
 * });
 * ```
 */
export function zohoSearchRecordsCriteriaString<T = any>(input: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoSearchRecordsCriteriaString> {
  let result: Maybe<ZohoSearchRecordsCriteriaString>;

  if (input != null) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- only string and object are valid for criteria input
    switch (typeof input) {
      case 'string':
        result = input;
        break;
      case 'object': {
        let tree: ZohoSearchRecordsCriteriaTree<T>;

        if (Array.isArray(input)) {
          tree = { and: [input] };
        } else {
          tree = input;
        }

        result = zohoSearchRecordsCriteriaStringForTree(tree);
        break;
      }
      default:
        break;
    }
  }

  return result;
}

/**
 * Compiles a {@link ZohoSearchRecordsCriteriaTree} into a criteria string by
 * recursively resolving nested AND/OR groups. When both `and` and `or` are
 * present at the same level, the OR group is merged into the AND group.
 *
 * @param tree - Criteria tree containing `and` and/or `or` branches
 * @returns Compiled criteria string, or `undefined` if the tree is empty
 */
export function zohoSearchRecordsCriteriaStringForTree<T = any>(tree: ZohoSearchRecordsCriteriaTree<T>): Maybe<ZohoSearchRecordsCriteriaString> {
  function convertToString(value: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>>): Maybe<ArrayOrValue<ZohoSearchRecordsCriteriaString>> {
    let result: Maybe<ArrayOrValue<ZohoSearchRecordsCriteriaString>>;

    if (typeof value === 'object') {
      // array of criteria entries
      if (Array.isArray(value)) {
        result = value.map(zohoSearchRecordsCriteriaEntryToCriteriaString);
      } else if (value) {
        // criteria tree that first needs to be converted to a string
        result = zohoSearchRecordsCriteriaStringForTree(value);
      }
    } else {
      result = value;
    }

    return result;
  }

  function mergeStringValues(values: ZohoSearchRecordsCriteriaString[], type: 'and' | 'or'): ZohoSearchRecordsCriteriaString {
    return values.length > 1 ? `(${values.join(type)})` : values[0]; // wrap in and values
  }

  function mergeValues(values: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>>[], type: 'and' | 'or'): ZohoSearchRecordsCriteriaString {
    const allStrings = filterMaybeArrayValues(values.map(convertToString)).flatMap(asArray);
    return mergeStringValues(allStrings, type);
  }

  const orValues: Maybe<ZohoSearchRecordsCriteriaString> = tree.or ? mergeValues(tree.or, 'or') : undefined;
  let result: Maybe<ZohoSearchRecordsCriteriaString> = orValues;

  if (tree.and) {
    result = mergeValues([mergeValues(tree.and, 'and'), orValues], 'and');
  }

  return result;
}

/**
 * Recursive tree structure for building complex Zoho search criteria with nested AND/OR groups.
 *
 * If both `and` and `or` are provided at the same level, the OR group is merged
 * into the AND group (i.e. `(and_items AND or_group)`).
 *
 * @see https://www.zoho.com/crm/developer/docs/api/v8/search-records.html
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 */
export interface ZohoSearchRecordsCriteriaTree<T = any> {
  /**
   * Items to AND together.
   */
  readonly and?: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR together.
   */
  readonly or?: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>[]>;
}

/**
 * Union of all valid input shapes for building a criteria string:
 * - {@link ZohoSearchRecordsCriteriaEntryArray} — array of field/filter/value entries (AND-joined)
 * - {@link ZohoSearchRecordsCriteriaTree} — nested AND/OR group structure
 * - {@link ZohoSearchRecordsCriteriaString} — pre-compiled raw criteria string
 */
export type ZohoSearchRecordsCriteriaTreeElement<T = any> = ZohoSearchRecordsCriteriaEntryArray<T> | ZohoSearchRecordsCriteriaTree<T> | ZohoSearchRecordsCriteriaString;

/**
 * Available filter operators for Zoho search criteria.
 *
 * - `starts_with` — field value starts with the given string
 * - `equals` — field value exactly matches the given string
 * - `contains` — field value contains the given string
 */
export type ZohoSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

/**
 * Array of criteria entries that are AND-joined when compiled to a criteria string.
 */
export type ZohoSearchRecordsCriteriaEntryArray<T = any> = ZohoSearchRecordsCriteriaEntry<T>[];

/**
 * Single search criteria entry specifying a field, filter operator, and value.
 *
 * The `field` is type-safe against the record type `T` when its keys are primitive.
 */
export interface ZohoSearchRecordsCriteriaEntry<T = any> {
  /**
   * The API field name to filter on (e.g. `'Last_Name'`, `'Email'`).
   */
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
  /**
   * The filter operator to apply.
   */
  readonly filter: ZohoSearchRecordsCriteriaFilterType;
  /**
   * The value to match against. Parentheses and commas are automatically escaped.
   */
  readonly value: string;
}

/**
 * Escapes parentheses and commas in a field value for use in a {@link ZohoSearchRecordsCriteriaString}.
 *
 * Characters `(`, `)`, and `,` are escaped with a double-backslash prefix as required by the Zoho API.
 */
export const escapeZohoFieldValueForCriteriaString = escapeStringCharactersFunction({
  /**
   * Parenthesis and commas must be escaped using a backslash
   */
  escapeTargets: ['(', ')', ','],
  escapeCharacter: (char: string) => `\\\\${char}`
});

/**
 * Converts a single {@link ZohoSearchRecordsCriteriaEntry} into a parenthesized criteria string.
 *
 * Automatically escapes parentheses and commas in the value via {@link escapeZohoFieldValueForCriteriaString}.
 *
 * @param entry - The criteria entry to convert
 * @returns Criteria string in the format `(field:filter:escapedValue)`
 *
 * @example
 * ```typescript
 * const str = zohoSearchRecordsCriteriaEntryToCriteriaString({
 *   field: 'Last_Name',
 *   filter: 'equals',
 *   value: 'Smith'
 * });
 * // => '(Last_Name:equals:Smith)'
 * ```
 */
export function zohoSearchRecordsCriteriaEntryToCriteriaString<T = any>(entry: ZohoSearchRecordsCriteriaEntry<T>): ZohoSearchRecordsCriteriaString {
  const escapedValue = escapeZohoFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}
