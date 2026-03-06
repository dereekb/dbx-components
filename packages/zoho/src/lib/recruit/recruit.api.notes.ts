import { type ZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';
import { type FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoRecruitContext } from './recruit.config';
import { ZOHO_RECRUIT_NOTES_MODULE, type ZohoRecruitModuleNameRef, type ZohoRecruitRecordId } from './recruit';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type ZohoRecruitMultiRecordResult, type ZohoRecruitChangeObjectResponseSuccessEntry, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitChangeObjectResponse, zohoRecruitApiFetchJsonInput, zohoRecruitMultiRecordResult, type ZohoRecruitGetRelatedRecordsRequest, zohoRecruitGetRelatedRecordsFunctionFactory } from './recruit.api';
import { type NewZohoRecruitNoteData, type ZohoRecruitNoteId, type ZohoRecruitRecordNote } from './recruit.notes';

// MARK: Notes
/**
 * Request for creating one or more notes in the Notes module.
 */
export interface ZohoRecruitCreateNotesRequest {
  readonly data: ZohoRecruitCreateNotesRequestEntry[];
}

/**
 * Paired success/error result from a bulk note creation operation.
 */
export type ZohoRecruitCreateNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitCreateNotesRequestEntry = NewZohoRecruitNoteData;
export type ZohoRecruitCreateNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitCreateNotesFunction = (input: ZohoRecruitCreateNotesRequest) => Promise<ZohoRecruitCreateNotesResult>;

/**
 * Creates one or more notes directly in the Notes module. The note data must include `se_module` and `Parent_Id` to link to a record.
 *
 * Prefer {@link zohoRecruitCreateNotesForRecord} when creating notes linked to a specific record, as it handles the module/parent linking automatically.
 */
export function zohoRecruitCreateNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitCreateNotesRequest) =>
    context.fetchJson<ZohoRecruitCreateNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}`, zohoRecruitApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

/**
 * Request for deleting one or more notes by their ids.
 */
export interface ZohoRecruitDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoRecruitNoteId>;
}

/**
 * Paired success/error result from a bulk note deletion operation.
 */
export type ZohoRecruitDeleteNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitDeleteNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitDeleteNotesFunction = (input: ZohoRecruitDeleteNotesRequest) => Promise<ZohoRecruitDeleteNotesResult>;

/**
 * Deletes one or more notes by their ids from the Notes module.
 */
export function zohoRecruitDeleteNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitDeleteNotesRequest) =>
    context.fetchJson<ZohoRecruitDeleteNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}?${makeUrlSearchParams({ ids: input.ids })}`, zohoRecruitApiFetchJsonInput('DELETE')).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

export type ZohoRecruitGetNotesForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;
export type ZohoRecruitGetNotesForRecordResponse = ZohoPageResult<ZohoRecruitRecordNote>;
export type ZohoRecruitGetNotesForRecordFunction = (input: ZohoRecruitGetNotesForRecordRequest) => Promise<ZohoRecruitGetNotesForRecordResponse>;

/**
 * Retrieves notes related to a specific record, using the related records API targeting the Notes module.
 */
export function zohoRecruitGetNotesForRecord(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordNote>({ targetModule: ZOHO_RECRUIT_NOTES_MODULE });
}

/**
 * Page factory type for paginated note retrieval.
 */
export type ZohoRecruitGetNotesForRecordPageFactory = FetchPageFactory<ZohoRecruitGetNotesForRecordRequest, ZohoRecruitGetNotesForRecordResponse>;

/**
 * Creates a page factory for iterating over notes related to a record across multiple pages.
 */
export function zohoRecruitGetNotesForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetNotesForRecord(context));
}

/**
 * Input for creating notes linked to a specific record. The `se_module` and `Parent_Id` fields are set automatically from the module and id.
 */
export interface ZohoRecruitCreateNotesForRecordRequest extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoRecruitNoteData, 'se_module' | 'Parent_Id'>>;
}

export type ZohoRecruitCreateNotesForRecordFunction = (input: ZohoRecruitCreateNotesForRecordRequest) => Promise<ZohoRecruitCreateNotesResult>;

/**
 * Creates one or more notes linked to a specific record. Automatically sets the module and parent id on each note entry before delegating to {@link zohoRecruitCreateNotes}.
 */
export function zohoRecruitCreateNotesForRecord(context: ZohoRecruitContext): ZohoRecruitCreateNotesForRecordFunction {
  const createNotesInstance = zohoRecruitCreateNotes(context);
  return (input: ZohoRecruitCreateNotesForRecordRequest) => {
    const { module: se_module, id: Parent_Id, notes } = input;
    const createNotesRequest: ZohoRecruitCreateNotesRequest = {
      data: asArray(notes).map((x) => ({
        ...x,
        se_module,
        Parent_Id
      }))
    };

    return createNotesInstance(createNotesRequest);
  };
}

// MARK: Compat
/**
 * @deprecated Use zohoRecruitCreateNotes instead.
 */
export const createNotes = zohoRecruitCreateNotes;

/**
 * @deprecated Use zohoRecruitDeleteNotes instead.
 */
export const deleteNotes = zohoRecruitDeleteNotes;

/**
 * @deprecated Use zohoRecruitGetNotesForRecord instead.
 */
export const getNotesForRecord = zohoRecruitGetNotesForRecord;

/**
 * @deprecated Use zohoRecruitGetNotesForRecordPageFactory instead.
 */
export const getNotesForRecordPageFactory = zohoRecruitGetNotesForRecordPageFactory;

/**
 * @deprecated Use zohoRecruitCreateNotesForRecord instead.
 */
export const createNotesForRecord = zohoRecruitCreateNotesForRecord;

/**
 * @deprecated Use ZohoRecruitGetNotesForRecordPageFactory instead.
 */
export type GetNotesForRecordPageFactory = ZohoRecruitGetNotesForRecordPageFactory;
