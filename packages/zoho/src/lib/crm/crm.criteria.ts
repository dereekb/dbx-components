import { type Maybe, type ArrayOrValue, filterMaybeArrayValues, asArray, type PrimativeKey, escapeStringCharactersFunction } from '@dereekb/util';

/**
 * Encoded criteria string.
 */
export type ZohoCrmSearchRecordsCriteriaString = string;

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_CRM_SEARCH_MODULE_RECORDS_CRITERIA = 10;

/**
 * Creates a ZohoCrmSearchRecordsCriteriaString from a ZohoCrmSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoCrmSearchRecordsCriteriaString<T = any>(input: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoCrmSearchRecordsCriteriaString> {
  let result: Maybe<ZohoCrmSearchRecordsCriteriaString>;

  if (input != null) {
    switch (typeof input) {
      case 'string':
        result = input;
        break;
      case 'object':
        let tree: ZohoCrmSearchRecordsCriteriaTree<T>;

        if (Array.isArray(input)) {
          tree = { and: [input] };
        } else {
          tree = input;
        }

        result = zohoCrmSearchRecordsCriteriaStringForTree(tree);
        break;
    }
  }

  return result;
}

export function zohoCrmSearchRecordsCriteriaStringForTree<T = any>(tree: ZohoCrmSearchRecordsCriteriaTree<T>): Maybe<ZohoCrmSearchRecordsCriteriaString> {
  function convertToString(value: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>>): Maybe<ArrayOrValue<ZohoCrmSearchRecordsCriteriaString>> {
    let result: Maybe<ArrayOrValue<ZohoCrmSearchRecordsCriteriaString>>;

    if (typeof value === 'object') {
      // array of criteria entries
      if (Array.isArray(value)) {
        result = value.map(zohoCrmSearchRecordsCriteriaEntryToCriteriaString);
      } else if (value) {
        // criteria tree that first needs to be converted to a string
        result = zohoCrmSearchRecordsCriteriaStringForTree(value);
      }
    } else {
      result = value;
    }

    return result;
  }

  function mergeStringValues(values: ZohoCrmSearchRecordsCriteriaString[], type: 'and' | 'or'): ZohoCrmSearchRecordsCriteriaString {
    return values.length > 1 ? `(${values.join(type)})` : values[0]; // wrap in and values
  }

  function mergeValues(values: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>>[], type: 'and' | 'or'): ZohoCrmSearchRecordsCriteriaString {
    const allStrings = filterMaybeArrayValues(values.map(convertToString)).flatMap(asArray);
    return mergeStringValues(allStrings, type);
  }

  const orValues: Maybe<ZohoCrmSearchRecordsCriteriaString> = tree.or ? mergeValues(tree.or, 'or') : undefined;
  let result: Maybe<ZohoCrmSearchRecordsCriteriaString> = orValues;

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
export interface ZohoCrmSearchRecordsCriteriaTree<T = any> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZohoCrmSearchRecordsCriteriaTreeElement<T = any> = ZohoCrmSearchRecordsCriteriaEntryArray<T> | ZohoCrmSearchRecordsCriteriaTree<T> | ZohoCrmSearchRecordsCriteriaString;

export type ZohoCrmSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZohoCrmSearchRecordsCriteriaEntryArray<T = any> = ZohoCrmSearchRecordsCriteriaEntry<T>[];

export interface ZohoCrmSearchRecordsCriteriaEntry<T = any> {
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
  readonly filter: ZohoCrmSearchRecordsCriteriaFilterType;
  readonly value: string;
}

/**
 * Escape used for ZohoCrmSearchRecordsCriteriaString
 */
export const escapeZohoCrmFieldValueForCriteriaString = escapeStringCharactersFunction({
  /**
   * Parenthesis and commas must be escaped using a backslash
   */
  escapeTargets: ['(', ')', ','],
  escapeCharacter: (char: string) => `\\${char}`
});

/**
 * Converts the input entry to a ZohoCrmSearchRecordsCriteriaString. Properly escapes any parenthesis or commas.
 *
 * @param entry
 * @returns
 */
export function zohoCrmSearchRecordsCriteriaEntryToCriteriaString<T = any>(entry: ZohoCrmSearchRecordsCriteriaEntry<T>): ZohoCrmSearchRecordsCriteriaString {
  const escapedValue = escapeZohoCrmFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}
