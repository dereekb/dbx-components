import { CommaSeparatedString, ISO8601DateString, Maybe, escapeStringCharactersFunction, filterMaybeValues, ArrayOrValue, asArray, UniqueModelWithId } from '@dereekb/util';

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

export type ZohoRecruitRecordFieldsData = Record<ZohoRecruitFieldName, any>;

export interface ZohoRecordDraftStateData {
  /**
   * Used to update a draft record or to convert a draft to a normal record.
   *
   * When creating, passing "draft" will create the record as a draft.
   */
  $state?: ZohoRecruitDraftOrSaveState;
}

export type NewZohoRecruitRecordData = ZohoRecruitRecordFieldsData & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing the corresponding record's id.
 */
export type UpdateZohoRecruitRecordData = UniqueModelWithId & ZohoRecruitRecordFieldsData & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing record details.
 */
export type ZohoRecruitRecord = UniqueModelWithId & ZohoRecruitRecordFieldsData;

/**
 * Update details returned by the server for an updated object.
 */
export interface ZohoRecruitRecordUpdateDetails {
  id: ZohoRecruitRecordId;
  Modified_Time: ISO8601DateString;
  Modified_By: ZohoRecruitCreatedByData;
  Created_Time: ISO8601DateString;
  Created_By: ZohoRecruitCreatedByData;
}

/**
 * Encoded criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaString = string;

/**
 * Creates a ZohoRecruitSearchRecordsCriteriaString from a ZohoRecruitSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoRecruitSearchRecordsCriteriaString<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData>(input: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
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

export function zohoRecruitSearchRecordsCriteriaStringForTree<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData>(tree: ZohoRecruitSearchRecordsCriteriaTree<T>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
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
export interface ZohoRecruitSearchRecordsCriteriaTree<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZohoRecruitSearchRecordsCriteriaTreeElement<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree | ZohoRecruitSearchRecordsCriteriaString;

export type ZohoRecruitSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZohoRecruitSearchRecordsCriteriaEntryArray<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

export interface ZohoRecruitSearchRecordsCriteriaEntry<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData> {
  readonly field: keyof T extends string ? keyof T : never;
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
export function zohoRecruitSearchRecordsCriteriaEntryToCriteriaString<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData>(entry: ZohoRecruitSearchRecordsCriteriaEntry<T>): ZohoRecruitSearchRecordsCriteriaString {
  const escapedValue = escapeZohoFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}
