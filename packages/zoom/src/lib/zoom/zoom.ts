import { CommaSeparatedString, ISO8601DateString, Maybe, escapeStringCharactersFunction, filterMaybeArrayValues, ArrayOrValue, asArray, UniqueModelWithId, WebsiteUrl, isStandardInternetAccessibleWebsiteUrl, PrimativeKey } from '@dereekb/util';

// MARK: Data Types
/**
 * Zoom Recruit module name.
 *
 * Example "Candidates"
 */
export type ZoomModuleName = string;

/**
 * Candidates module name
 */
export const ZOOM_RECRUIT_CANDIDATES_MODULE = 'Candidates';

/**
 * Contains a reference to a module.
 */
export interface ZoomModuleNameRef {
  readonly module: ZoomModuleName;
}

/**
 * The API name of a function that is accessible via the Recruit REST API
 */
export type ZoomRestFunctionApiName = string;

/**
 * An identifier in Zoom Recruit.
 */
export type ZoomId = string;

/**
 * Zoom Recruit record id
 *
 * Example "576214000000569001"
 */
export type ZoomRecordId = string;

/**
 * Zoom Recruit type id
 *
 * Example "576214000000820595"
 */
export type ZoomTypeId = string;

/**
 * Zoom Recruit user identifier.
 *
 * Users can be found in the Users and Controls section in settings.
 */
export type ZoomUserId = string;

/**
 * Zoom Recruit custom view id
 */
export type ZoomCustomViewId = string;

/**
 * Zoom Recruit territory id
 */
export type ZoomTerritoryId = string;

/**
 * The name of a field on a record.
 */
export type ZoomFieldName = string;

export type ZoomDraftOrSaveState = 'draft' | 'save';

/**
 * Comma separated list of field names
 */
export type ZoomCommaSeparateFieldNames = CommaSeparatedString;

export type ZoomTrueFalseBoth = 'true' | 'false' | 'both';

export interface ZoomReferenceData {
  name: string;
  id: ZoomId;
}

/**
 * Reference pair of a Zoom Recruit user name and id
 */
export interface ZoomUserReferenceData {
  name: string;
  id: ZoomUserId;
}

export interface ZoomReferenceDataWithModule extends ZoomReferenceData, ZoomModuleNameRef {}

export type ZoomCreatedByData = ZoomUserReferenceData;
export type ZoomCandidateOwner = ZoomUserReferenceData;

export interface ZoomModifiedByData extends ZoomReferenceData {
  zuid: ZoomId;
}

export type ZoomParentReferenceData = ZoomReferenceDataWithModule;

/**
 * Zoom Recruit only allows URLs that can be resolved via the internet (I.E. uses a normal tdl)
 *
 * The following are considered invalid:
 * - localhost:8080
 * - ht://dereekb.com
 */
export type ZoomValidUrl = WebsiteUrl;

/**
 * Update details returned by the server for a created/updated object.
 */
export interface ZoomChangeObjectDetails {
  id: ZoomRecordId;
  Modified_Time: ISO8601DateString;
  Modified_By: ZoomCreatedByData;
  Created_Time: ISO8601DateString;
  Created_By: ZoomCreatedByData;
}

// MARK: Zoom Recruit Record
/**
 * Base Zoom Recruit field data type.
 */
export interface ZoomRecordFieldsData {}

export interface ZoomRecordDraftStateData {
  /**
   * Used to update a draft record or to convert a draft to a normal record.
   *
   * When creating, passing "draft" will create the record as a draft.
   */
  $state?: ZoomDraftOrSaveState;
}

export type NewZoomRecordData<T = ZoomRecordFieldsData> = T & ZoomRecordDraftStateData;

/**
 * A Zoom record containing the corresponding record's id.
 */
export type UpdateZoomRecordData = UniqueModelWithId & ZoomRecordFieldsData & ZoomRecordDraftStateData;

/**
 * A Zoom record containing record details.
 */
export type ZoomRecord = UniqueModelWithId & ZoomRecordFieldsData;

/**
 * Returns true if it is a valid ZoomValidUrl.
 */
export const isZoomValidUrl: (input: WebsiteUrl) => input is ZoomValidUrl = isStandardInternetAccessibleWebsiteUrl;

/**
 * Update details returned by the server for an updated record.
 *
 * @deprecated use ZoomChangeObjectDetails instead.
 */
export type ZoomRecordUpdateDetails = ZoomChangeObjectDetails;

/**
 * Encoded criteria string.
 */
export type ZoomSearchRecordsCriteriaString = string;

/**
 * Creates a ZoomSearchRecordsCriteriaString from a ZoomSearchRecordsCriteriaTree.
 *
 * If the input tree is empty, returns undefined.
 */
export function zoomSearchRecordsCriteriaString<T = any>(input: Maybe<ZoomSearchRecordsCriteriaTreeElement<T>>): Maybe<ZoomSearchRecordsCriteriaString> {
  let result: Maybe<ZoomSearchRecordsCriteriaString>;

  if (input != null) {
    switch (typeof input) {
      case 'string':
        result = input;
        break;
      case 'object':
        let tree: ZoomSearchRecordsCriteriaTree<T>;

        if (Array.isArray(input)) {
          tree = { and: [input] };
        } else {
          tree = input;
        }

        result = zoomSearchRecordsCriteriaStringForTree(tree);
        break;
    }
  }

  return result;
}

export function zoomSearchRecordsCriteriaStringForTree<T = any>(tree: ZoomSearchRecordsCriteriaTree<T>): Maybe<ZoomSearchRecordsCriteriaString> {
  function convertToString(value: Maybe<ZoomSearchRecordsCriteriaTreeElement<T>>): Maybe<ArrayOrValue<ZoomSearchRecordsCriteriaString>> {
    let result: Maybe<ArrayOrValue<ZoomSearchRecordsCriteriaString>>;

    if (typeof value === 'object') {
      // array of criteria entries
      if (Array.isArray(value)) {
        result = value.map(zoomSearchRecordsCriteriaEntryToCriteriaString);
      } else if (value) {
        // criteria tree that first needs to be converted to a string
        result = zoomSearchRecordsCriteriaStringForTree(value);
      }
    } else {
      result = value;
    }

    return result;
  }

  function mergeStringValues(values: ZoomSearchRecordsCriteriaString[], type: 'and' | 'or'): ZoomSearchRecordsCriteriaString {
    return values.length > 1 ? `(${values.join(type)})` : values[0]; // wrap in and values
  }

  function mergeValues(values: Maybe<ZoomSearchRecordsCriteriaTreeElement<T>>[], type: 'and' | 'or'): ZoomSearchRecordsCriteriaString {
    const allStrings = filterMaybeArrayValues(values.map(convertToString)).flatMap(asArray);
    return mergeStringValues(allStrings, type);
  }

  const orValues: Maybe<ZoomSearchRecordsCriteriaString> = tree.or ? mergeValues(tree.or, 'or') : undefined;
  let result: Maybe<ZoomSearchRecordsCriteriaString> = orValues;

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
export interface ZoomSearchRecordsCriteriaTree<T = any> {
  /**
   * Items to AND with eachother
   */
  readonly and?: Maybe<ZoomSearchRecordsCriteriaTreeElement<T>[]>;
  /**
   * Items to OR with eachother
   */
  readonly or?: Maybe<ZoomSearchRecordsCriteriaTreeElement<T>[]>;
}

export type ZoomSearchRecordsCriteriaTreeElement<T = any> = ZoomSearchRecordsCriteriaEntryArray<T> | ZoomSearchRecordsCriteriaTree<T> | ZoomSearchRecordsCriteriaString;

export type ZoomSearchRecordsCriteriaFilterType = 'starts_with' | 'equals' | 'contains';

export type ZoomSearchRecordsCriteriaEntryArray<T = any> = ZoomSearchRecordsCriteriaEntry<T>[];

export interface ZoomSearchRecordsCriteriaEntry<T = any> {
  readonly field: keyof T extends PrimativeKey ? keyof T : PrimativeKey;
  readonly filter: ZoomSearchRecordsCriteriaFilterType;
  readonly value: string;
}

/**
 * Escape used for ZoomSearchRecordsCriteriaString
 */
export const escapeZoomFieldValueForCriteriaString = escapeStringCharactersFunction({
  /**
   * Parenthesis and commas must be escaped using a backslash
   */
  escapeTargets: ['(', ')', ','],
  escapeCharacter: (char: string) => `\\${char}`
});

/**
 * Converts the input entry to a ZoomSearchRecordsCriteriaString. Properly escapes any parenthesis or commas.
 *
 * @param entry
 * @returns
 */
export function zoomSearchRecordsCriteriaEntryToCriteriaString<T = any>(entry: ZoomSearchRecordsCriteriaEntry<T>): ZoomSearchRecordsCriteriaString {
  const escapedValue = escapeZoomFieldValueForCriteriaString(entry.value);
  return `(${entry.field}:${entry.filter}:${escapedValue})`;
}

// MARK: Notes
export type ZoomNoteId = string;

export interface ZoomNoteAction {
  $is_system_action: boolean;
}

export type ZoomNoteSourceName = 'NORMAL_USER';
export type ZoomNoteSourceType = number;

export interface ZoomNoteSource {
  name: ZoomNoteSourceName;
  type: ZoomNoteSourceType;
}

export type ZoomNoteOwnerData = ZoomReferenceData;

export interface ZoomNoteData {
  Note_Title: string;
  Note_Content: string;
  Parent_Id: ZoomParentReferenceData;
  Created_Time: ISO8601DateString;
  Modified_Time: ISO8601DateString;
  $attachments: null;
  $is_edit_allowed: boolean;
  $editable: boolean;
  $type_id: ZoomTypeId;
  $is_delete_allowed: boolean;
  $note_action: ZoomNoteAction;
  $source: ZoomNoteSource;
  $se_module: ZoomModuleName;
  $is_shared_to_client: boolean;
  Note_Owner: ZoomNoteOwnerData;
  Created_By: ZoomCreatedByData;
  Modified_By: ZoomModifiedByData;
  $size: ZoomNoteFileSize | null;
  $voice_note: boolean;
  $status: ZoomNoteStatus;
}

export interface NewZoomNoteData extends Pick<ZoomNoteData, 'Note_Title' | 'Note_Content'> {
  Parent_Id: Pick<ZoomParentReferenceData, 'id'> | ZoomId;
  se_module: ZoomModuleName;
}

export type ZoomNoteStatus = string; // TODO
export type ZoomNoteFileSize = number;

export interface ZoomNote extends ZoomNoteData, UniqueModelWithId {}

export type ZoomRecordNote = ZoomNote;

// MARK: Compat
/**
 * @deprecated use NewZoomNewNoteData instead.
 */
export type NewZoomNewNoteData = NewZoomNoteData;
