import { CommaSeparatedString, ISO8601DateString, Maybe, escapeStringCharactersFunction, filterMaybeValues, ArrayOrValue, asArray, UniqueModelWithId, WebsiteUrl, isStandardInternetAccessibleWebsiteUrl, PrimativeKey } from '@dereekb/util';

// MARK: Data Types
/**
 * Zoho Recruit module name.
 *
 * Example "Candidates"
 */
export type ZohoRecruitModuleName = string;

/**
 * Candidates module name
 */
export const ZOHO_RECRUIT_CANDIDATES_MODULE = 'Candidates';

/**
 * Contains a reference to a module.
 */
export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

/**
 * An identifier in Zoho Recruit.
 */
export type ZohoRecruitId = string;

/**
 * Zoho Recruit record id
 *
 * Example "576214000000569001"
 */
export type ZohoRecruitRecordId = string;

/**
 * Zoho Recruit type id
 *
 * Example "576214000000820595"
 */
export type ZohoRecruitTypeId = string;

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

export interface ZohoRecruitReferenceData {
  name: string;
  id: ZohoRecruitId;
}

export interface ZohoRecruitReferenceDataWithModule extends ZohoRecruitReferenceData, ZohoRecruitModuleNameRef {}

export type ZohoRecruitCreatedByData = ZohoRecruitReferenceData;

export interface ZohoRecruitModifiedByData extends ZohoRecruitReferenceData {
  zuid: ZohoRecruitId;
}

export type ZohoRecruitParentReferenceData = ZohoRecruitReferenceDataWithModule;

/**
 * Zoho Recruit only allows URLs that can be resolved via the internet (I.E. uses a normal tdl)
 *
 * The following are considered invalid:
 * - localhost:8080
 * - ht://dereekb.com
 */
export type ZohoRecruitValidUrl = WebsiteUrl;

/**
 * Update details returned by the server for a created/updated object.
 */
export interface ZohoRecruitChangeObjectDetails {
  id: ZohoRecruitRecordId;
  Modified_Time: ISO8601DateString;
  Modified_By: ZohoRecruitCreatedByData;
  Created_Time: ISO8601DateString;
  Created_By: ZohoRecruitCreatedByData;
}

// MARK: Zoho Recruit Record
/**
 * Base Zoho Recruit field data type.
 */
export interface ZohoRecruitRecordFieldsData {}

export interface ZohoRecordDraftStateData {
  /**
   * Used to update a draft record or to convert a draft to a normal record.
   *
   * When creating, passing "draft" will create the record as a draft.
   */
  $state?: ZohoRecruitDraftOrSaveState;
}

export type NewZohoRecruitRecordData<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecordFieldsData> = T & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing the corresponding record's id.
 */
export type UpdateZohoRecruitRecordData = UniqueModelWithId & ZohoRecruitRecordFieldsData & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing record details.
 */
export type ZohoRecruitRecord = UniqueModelWithId & ZohoRecruitRecordFieldsData;

/**
 * Returns true if it is a valid ZohoRecruitValidUrl.
 */
export const isZohoRecruitValidUrl: (input: WebsiteUrl) => input is ZohoRecruitValidUrl = isStandardInternetAccessibleWebsiteUrl;

/**
 * Update details returned by the server for an updated record.
 *
 * @deprecated use ZohoRecruitChangeObjectDetails instead.
 */
export type ZohoRecruitRecordUpdateDetails = ZohoRecruitChangeObjectDetails;

/**
 * Encoded criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaString = string;

/**
 * Creates a ZohoRecruitSearchRecordsCriteriaString from a ZohoRecruitSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zohoRecruitSearchRecordsCriteriaString<T extends ZohoRecruitRecordFieldsData = any>(input: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
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

export function zohoRecruitSearchRecordsCriteriaStringForTree<T extends ZohoRecruitRecordFieldsData = any>(tree: ZohoRecruitSearchRecordsCriteriaTree<T>): Maybe<ZohoRecruitSearchRecordsCriteriaString> {
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
export interface ZohoRecruitSearchRecordsCriteriaTree<T extends ZohoRecruitRecordFieldsData = any> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZohoRecruitSearchRecordsCriteriaTreeElement<T extends ZohoRecruitRecordFieldsData = any> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree | ZohoRecruitSearchRecordsCriteriaString;

export type ZohoRecruitSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZohoRecruitSearchRecordsCriteriaEntryArray<T extends ZohoRecruitRecordFieldsData = any> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

export interface ZohoRecruitSearchRecordsCriteriaEntry<T extends ZohoRecruitRecordFieldsData = any> {
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
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
export function zohoRecruitSearchRecordsCriteriaEntryToCriteriaString<T extends ZohoRecruitRecordFieldsData = any>(entry: ZohoRecruitSearchRecordsCriteriaEntry<T>): ZohoRecruitSearchRecordsCriteriaString {
  const escapedValue = escapeZohoFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}

// MARK: Notes
export type ZohoRecruitNoteId = string;

export interface ZohoRecruitNoteAction {
  $is_system_action: boolean;
}

export type ZohoRecruitNoteSourceName = 'NORMAL_USER';
export type ZohoRecruitNoteSourceType = number;

export interface ZohoRecruitNoteSource {
  name: ZohoRecruitNoteSourceName;
  type: ZohoRecruitNoteSourceType;
}

export type ZohoRecruitNoteOwnerData = ZohoRecruitReferenceData;

export interface ZohoRecruitNoteData {
  Note_Title: string;
  Note_Content: string;
  Parent_Id: ZohoRecruitParentReferenceData;
  Created_Time: ISO8601DateString;
  Modified_Time: ISO8601DateString;
  $attachments: null;
  $is_edit_allowed: boolean;
  $editable: boolean;
  $type_id: ZohoRecruitTypeId;
  $is_delete_allowed: boolean;
  $note_action: ZohoRecruitNoteAction;
  $source: ZohoRecruitNoteSource;
  $se_module: ZohoRecruitModuleName;
  $is_shared_to_client: boolean;
  Note_Owner: ZohoRecruitNoteOwnerData;
  Created_By: ZohoRecruitCreatedByData;
  Modified_By: ZohoRecruitModifiedByData;
  $size: ZohoRecruitNoteFileSize | null;
  $voice_note: boolean;
  $status: ZohoRecruitNoteStatus;
}

export interface NewZohoRecruitNoteData extends Pick<ZohoRecruitNoteData, 'Note_Title' | 'Note_Content'> {
  Parent_Id: Pick<ZohoRecruitParentReferenceData, 'id'> | ZohoRecruitId;
  se_module: ZohoRecruitModuleName;
}

export type ZohoRecruitNoteStatus = string; // TODO
export type ZohoRecruitNoteFileSize = number;

export interface ZohoRecruitNote extends ZohoRecruitNoteData, UniqueModelWithId {}

export type ZohoRecruitRecordNote = ZohoRecruitNote;

// MARK: Compat
/**
 * @deprecated use NewZohoRecruitNewNoteData instead.
 */
export type NewZohoRecruitNewNoteData = NewZohoRecruitNoteData;
