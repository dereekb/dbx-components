import { type Maybe, type ArrayOrValue, filterMaybeArrayValues, asArray, type PrimativeKey, escapeStringCharactersFunction } from '@dereekb/util';

/**
 * Encoded criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaString = string;

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_RECRUIT_SEARCH_MODULE_RECORDS_CRITERIA = 10;

/**
 * Creates a ZohoRecruitSearchRecordsCriteriaString from a ZohoRecruitSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoRecruitSearchRecordsCriteriaString<T = any>(input: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
  let result: Maybe<ZohoRecruitSearchRecordsCriteriaString>;

  if (input != null) {
    switch (typeof input) {
      case 'string':
        result = input;
        break;
      case 'object':
        let tree: ZohoRecruitSearchRecordsCriteriaTree<T>;

        if (Array.isArray(input)) {
          tree = { and: [input] };
        } else {
          tree = input;
        }

        result = zohoRecruitSearchRecordsCriteriaStringForTree(tree);
        break;
    }
  }

  return result;
}

export function zohoRecruitSearchRecordsCriteriaStringForTree<T = any>(tree: ZohoRecruitSearchRecordsCriteriaTree<T>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
  function convertToString(value: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>): Maybe<ArrayOrValue<ZohoRecruitSearchRecordsCriteriaString>> {
    let result: Maybe<ArrayOrValue<ZohoRecruitSearchRecordsCriteriaString>>;

    if (typeof value === 'object') {
      // array of criteria entries
      if (Array.isArray(value)) {
        result = value.map(zohoRecruitSearchRecordsCriteriaEntryToCriteriaString);
      } else if (value) {
        // criteria tree that first needs to be converted to a string
        result = zohoRecruitSearchRecordsCriteriaStringForTree(value);
      }
    } else {
      result = value;
    }

    return result;
  }

  function mergeStringValues(values: ZohoRecruitSearchRecordsCriteriaString[], type: 'and' | 'or'): ZohoRecruitSearchRecordsCriteriaString {
    return values.length > 1 ? `(${values.join(type)})` : values[0]; // wrap in and values
  }

  function mergeValues(values: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>[], type: 'and' | 'or'): ZohoRecruitSearchRecordsCriteriaString {
    const allStrings = filterMaybeArrayValues(values.map(convertToString)).flatMap(asArray);
    return mergeStringValues(allStrings, type);
  }

  const orValues: Maybe<ZohoRecruitSearchRecordsCriteriaString> = tree.or ? mergeValues(tree.or, 'or') : undefined;
  let result: Maybe<ZohoRecruitSearchRecordsCriteriaString> = orValues;

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
export interface ZohoRecruitSearchRecordsCriteriaTree<T = any> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZohoRecruitSearchRecordsCriteriaTreeElement<T = any> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree<T> | ZohoRecruitSearchRecordsCriteriaString;

export type ZohoRecruitSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZohoRecruitSearchRecordsCriteriaEntryArray<T = any> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

export interface ZohoRecruitSearchRecordsCriteriaEntry<T = any> {
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
  readonly filter: ZohoRecruitSearchRecordsCriteriaFilterType;
  readonly value: string;
}

/**
 * Escape used for ZohoRecruitSearchRecordsCriteriaString
 */
export const escapeZohoRecruitFieldValueForCriteriaString = escapeStringCharactersFunction({
  /**
   * Parenthesis and commas must be escaped using a backslash
   */
  escapeTargets: ['(', ')', ','],
  escapeCharacter: (char: string) => `\\${char}`
});

/**
 * Converts the input entry to a ZohoRecruitSearchRecordsCriteriaString. Properly escapes any parenthesis or commas.
 *
 * @param entry
 * @returns
 */
export function zohoRecruitSearchRecordsCriteriaEntryToCriteriaString<T = any>(entry: ZohoRecruitSearchRecordsCriteriaEntry<T>): ZohoRecruitSearchRecordsCriteriaString {
  const escapedValue = escapeZohoRecruitFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}

// MARK: Compat
/**
 * @deprecated Use escapeZohoRecruitFieldValueForCriteriaString instead.
 */
export const escapeZohoFieldValueForCriteriaString = escapeZohoRecruitFieldValueForCriteriaString;
