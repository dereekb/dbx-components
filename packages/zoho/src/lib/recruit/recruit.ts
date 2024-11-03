import { CommaSeparatedString, ISO8601DateString, Maybe, PageNumber, escapeStringCharactersFunction, replaceStringsFunction, convertToArray, filterMaybeValues, ArrayOrValue, asArray } from '@dereekb/util';

/**
 * Zoho Recruit module name.
 *
 * Example "Candidates"
 */
export type ZohoRecruitModuleName = string;

/**
 * Zoho Recruit record id
 *
 * Example "576214000000569001"
 */
export type ZohoRecruitRecordId = string;

/**
 * Zoho Recruit custom view id
 */
export type ZohoRecruitCustomViewId = string;

/**
 * Zoho Recruit territory id
 */
export type ZohoRecruitTerritoryId = string;

/**
 * The name of a field on a record.
 */
export type ZohoRecruitFieldName = string;

export type ZohoRecruitDraftOrSaveState = 'draft' | 'save';

/**
 * Comma separated list of field names
 */
export type ZohoRecruitCommaSeparateFieldNames = CommaSeparatedString;

export type ZohoRecruitTrueFalseBoth = 'true' | 'false' | 'both';

export interface ZohoRecruitCreatedByData {
  name: string;
  id: string; // TODO: figure out what kind of id this is
}

export type ZohoNewRecruitRecord = Record<ZohoRecruitFieldName, any> & {
  /**
   * Use "draft" if the record should be created as a draft.
   */
  $state?: ZohoRecruitDraftOrSaveState;
};

export type ZohoRecruitRecord = Record<ZohoRecruitFieldName, any> & {
  id: ZohoRecruitRecordId;
  Updated_On: ISO8601DateString;
  Created_By: ZohoRecruitCreatedByData;
};

/**
 * Encoded criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaString = string;

/**
 * Creates a ZohoRecruitSearchRecordsCriteriaString from a ZohoRecruitSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoRecruitSearchRecordsCriteriaString(tree: ZohoRecruitSearchRecordsCriteriaTree): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
  function convertToString(value: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement>): Maybe<ArrayOrValue<ZohoRecruitSearchRecordsCriteriaString>> {
    let result: Maybe<ArrayOrValue<ZohoRecruitSearchRecordsCriteriaString>>;

    if (typeof value === 'object') {
      // array of criteria entries
      if (Array.isArray(value)) {
        result = value.map(zohoRecruitSearchRecordsCriteriaEntryToCriteriaString);
      } else if (value) {
        // criteria tree that first needs to be converted to a string
        result = zohoRecruitSearchRecordsCriteriaString(value);
      }
    } else {
      result = value;
    }

    return result;
  }

  function mergeStringValues(values: ZohoRecruitSearchRecordsCriteriaString[], type: 'and' | 'or'): ZohoRecruitSearchRecordsCriteriaString {
    return values.length > 1 ? `(${values.join(type)})` : values[0]; // wrap in and values
  }

  function mergeValues(values: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement>[], type: 'and' | 'or'): ZohoRecruitSearchRecordsCriteriaString {
    const allStrings = filterMaybeValues(values.map(convertToString)).flatMap(asArray);
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
export interface ZohoRecruitSearchRecordsCriteriaTree {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement[]>;
}

export type ZohoRecruitSearchRecordsCriteriaTreeElement = ZohoRecruitSearchRecordsCriteriaTree | ZohoRecruitSearchRecordsCriteriaEntry[] | ZohoRecruitSearchRecordsCriteriaString;

export type ZohoRecruitSearchRecordsCriteriaFilterType = 'starts_With' | 'equals' | 'contains';

export interface ZohoRecruitSearchRecordsCriteriaEntry {
  readonly field: ZohoRecruitFieldName;
  readonly filter: ZohoRecruitSearchRecordsCriteriaFilterType;
  readonly value: string;
}

/**
 * Escape used for ZohoRecruitSearchRecordsCriteriaString
 */
export const escapeZohoFieldValueForCriteriaString = escapeStringCharactersFunction({
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
export function zohoRecruitSearchRecordsCriteriaEntryToCriteriaString(entry: ZohoRecruitSearchRecordsCriteriaEntry): ZohoRecruitSearchRecordsCriteriaString {
  const escapedValue = escapeZohoFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}
