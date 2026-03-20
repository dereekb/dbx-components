import { type ZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';
import { type FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoCrmContext } from './crm.config';
import { ZOHO_CRM_NOTES_MODULE, type ZohoCrmModuleNameRef, type ZohoCrmRecordId } from './crm';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type ZohoCrmMultiRecordResult, type ZohoCrmChangeObjectResponseSuccessEntry, type ZohoCrmChangeObjectResponseErrorEntry, type ZohoCrmChangeObjectResponse, zohoCrmApiFetchJsonInput, zohoCrmMultiRecordResult, zohoCrmGetRelatedRecordsFunctionFactory, type ZohoCrmGetRelatedRecordsRequestWithFields } from './crm.api';
import { type NewZohoCrmNoteData, type ZohoCrmNoteId, type ZohoCrmRecordNote } from './crm.notes';

// MARK: Notes
/**
 * Input for creating one or more notes in the CRM Notes module.
 */
export interface ZohoCrmCreateNotesRequest {
  readonly data: ZohoCrmCreateNotesRequestEntry[];
}

/**
 * Paired result mapping each input entry to its success or error outcome.
 */
export type ZohoCrmCreateNotesResult = ZohoCrmMultiRecordResult<ZohoCrmCreateNotesRequestEntry, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;

/**
 * Individual note entry within a create request.
 */
export type ZohoCrmCreateNotesRequestEntry = NewZohoCrmNoteData;
/**
 * Raw API response from the CRM create notes endpoint.
 */
export type ZohoCrmCreateNotesResponse = ZohoCrmChangeObjectResponse;
export type ZohoCrmCreateNotesFunction = (input: ZohoCrmCreateNotesRequest) => Promise<ZohoCrmCreateNotesResult>;

/**
 * Creates notes directly in the CRM Notes module. Each note must include the parent record reference and module name.
 *
 * For creating notes associated with a specific record, prefer {@link zohoCrmCreateNotesForRecord} which handles parent binding automatically.
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @returns Function that creates notes in the CRM Notes module
 */
export function zohoCrmCreateNotes(context: ZohoCrmContext) {
  return (input: ZohoCrmCreateNotesRequest) =>
    context.fetchJson<ZohoCrmCreateNotesResponse>(`/v2/${ZOHO_CRM_NOTES_MODULE}`, zohoCrmApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoCrmMultiRecordResult<ZohoCrmCreateNotesRequestEntry, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

/**
 * Input for deleting one or more notes by their IDs.
 */
export interface ZohoCrmDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoCrmNoteId>;
}

/**
 * Paired result mapping each note ID to its success or error outcome.
 */
export type ZohoCrmDeleteNotesResult = ZohoCrmMultiRecordResult<ZohoCrmNoteId, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;

/**
 * Raw API response from the CRM delete notes endpoint.
 */
export type ZohoCrmDeleteNotesResponse = ZohoCrmChangeObjectResponse;
export type ZohoCrmDeleteNotesFunction = (input: ZohoCrmDeleteNotesRequest) => Promise<ZohoCrmDeleteNotesResult>;

/**
 * Deletes one or more notes from the CRM Notes module by their IDs.
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @returns Function that deletes notes by their IDs
 */
export function zohoCrmDeleteNotes(context: ZohoCrmContext) {
  return (input: ZohoCrmDeleteNotesRequest) =>
    context.fetchJson<ZohoCrmDeleteNotesResponse>(`/v2/${ZOHO_CRM_NOTES_MODULE}?${makeUrlSearchParams({ ids: input.ids })}`, zohoCrmApiFetchJsonInput('DELETE')).then((x) => {
      return zohoCrmMultiRecordResult<ZohoCrmNoteId, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

/**
 * Request parameters for retrieving notes associated with a record, supporting field selection.
 */
export type ZohoCrmGetNotesForRecordRequest = ZohoCrmGetRelatedRecordsRequestWithFields;
/**
 * Paginated response containing notes for a record.
 */
export type ZohoCrmGetNotesForRecordResponse = ZohoPageResult<ZohoCrmRecordNote>;
export type ZohoCrmGetNotesForRecordFunction = (input: ZohoCrmGetNotesForRecordRequest) => Promise<ZohoCrmGetNotesForRecordResponse>;

/**
 * Retrieves paginated notes associated with a specific CRM record using the related records API.
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @returns Function that retrieves notes for a specific record
 */
export function zohoCrmGetNotesForRecord(context: ZohoCrmContext): ZohoCrmGetNotesForRecordFunction {
  return zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordNote>({ targetModule: ZOHO_CRM_NOTES_MODULE });
}

export type ZohoCrmGetNotesForRecordPageFactory = FetchPageFactory<ZohoCrmGetNotesForRecordRequest, ZohoCrmGetNotesForRecordResponse>;

/**
 * Creates a page factory for iterating through all notes for a record across multiple pages.
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @returns Page factory for paginating through notes for a record
 */
export function zohoCrmGetNotesForRecordPageFactory(context: ZohoCrmContext): ZohoCrmGetNotesForRecordPageFactory {
  return zohoFetchPageFactory(zohoCrmGetNotesForRecord(context));
}

/**
 * Input for creating notes bound to a specific record. The module and parent ID are set automatically from the request fields.
 */
export interface ZohoCrmCreateNotesForRecordRequest extends ZohoCrmModuleNameRef {
  readonly id: ZohoCrmRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoCrmNoteData, 'se_module' | 'Parent_Id'>>;
}

export type ZohoCrmCreateNotesForRecordFunction = (input: ZohoCrmCreateNotesForRecordRequest) => Promise<ZohoCrmCreateNotesResult>;

/**
 * Creates notes for a specific record, automatically binding the parent module and record ID to each note entry.
 *
 * https://www.zoho.com/crm/developer/docs/api/v8/create-notes.html
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @returns Function that creates notes bound to a specific record
 */
export function zohoCrmCreateNotesForRecord(context: ZohoCrmContext): ZohoCrmCreateNotesForRecordFunction {
  const createNotesInstance = zohoCrmCreateNotes(context);
  return (input: ZohoCrmCreateNotesForRecordRequest) => {
    const { module: se_module, id: Parent_Id, notes } = input;
    const createNotesRequest: ZohoCrmCreateNotesRequest = {
      data: asArray(notes).map((x) => ({
        ...x,
        se_module,
        Parent_Id
      }))
    };

    return createNotesInstance(createNotesRequest);
  };
}
