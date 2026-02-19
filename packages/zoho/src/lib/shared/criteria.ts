import { type Maybe, type ArrayOrValue, filterMaybeArrayValues, asArray, type PrimativeKey, escapeStringCharactersFunction } from '@dereekb/util';

/**
 * Encoded criteria string.
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
 * Creates a ZohoSearchRecordsCriteriaString from a ZohoSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoSearchRecordsCriteriaString<T = any>(input: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoSearchRecordsCriteriaString> {
  let result: Maybe<ZohoSearchRecordsCriteriaString>;

  if (input != null) {
    switch (typeof input) {
      case 'string':
        result = input;
        break;
      case 'object':
        let tree: ZohoSearchRecordsCriteriaTree<T>;

        if (Array.isArray(input)) {
          tree = { and: [input] };
        } else {
          tree = input;
        }

        result = zohoSearchRecordsCriteriaStringForTree(tree);
        break;
    }
  }

  return result;
}

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
 * Tree items
 *
 * If both AND and OR values are provided at the root tree, then the will be merged together with AND.
 */
export interface ZohoSearchRecordsCriteriaTree<T = any> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZohoSearchRecordsCriteriaTreeElement<T = any> = ZohoSearchRecordsCriteriaEntryArray<T> | ZohoSearchRecordsCriteriaTree<T> | ZohoSearchRecordsCriteriaString;

export type ZohoSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZohoSearchRecordsCriteriaEntryArray<T = any> = ZohoSearchRecordsCriteriaEntry<T>[];

export interface ZohoSearchRecordsCriteriaEntry<T = any> {
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
  readonly filter: ZohoSearchRecordsCriteriaFilterType;
  readonly value: string;
}

/**
 * Escape used for ZohoSearchRecordsCriteriaString
 */
export const escapeZohoFieldValueForCriteriaString = escapeStringCharactersFunction({
  /**
   * Parenthesis and commas must be escaped using a backslash
   */
  escapeTargets: ['(', ')', ','],
  escapeCharacter: (char: string) => `\\\\${char}`
});

/**
 * Converts the input entry to a ZohoSearchRecordsCriteriaString. Properly escapes any parenthesis or commas.
 *
 * @param entry
 * @returns
 */
export function zohoSearchRecordsCriteriaEntryToCriteriaString<T = any>(entry: ZohoSearchRecordsCriteriaEntry<T>): ZohoSearchRecordsCriteriaString {
  const escapedValue = escapeZohoFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}
