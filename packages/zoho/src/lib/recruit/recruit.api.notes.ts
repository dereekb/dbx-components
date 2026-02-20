import { type ZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';
import { type FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoRecruitContext } from './recruit.config';
import { ZOHO_RECRUIT_NOTES_MODULE, type ZohoRecruitModuleNameRef, type ZohoRecruitRecordId } from './recruit';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type ZohoRecruitMultiRecordResult, type ZohoRecruitChangeObjectResponseSuccessEntry, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitChangeObjectResponse, zohoRecruitApiFetchJsonInput, zohoRecruitMultiRecordResult, type ZohoRecruitGetRelatedRecordsRequest, zohoRecruitGetRelatedRecordsFunctionFactory } from './recruit.api';
import { type NewZohoRecruitNoteData, type ZohoRecruitNoteId, type ZohoRecruitRecordNote } from './recruit.notes';

// MARK: Notes
export interface ZohoRecruitCreateNotesRequest {
  readonly data: ZohoRecruitCreateNotesRequestEntry[];
}

export type ZohoRecruitCreateNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitCreateNotesRequestEntry = NewZohoRecruitNoteData;
export type ZohoRecruitCreateNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitCreateNotesFunction = (input: ZohoRecruitCreateNotesRequest) => Promise<ZohoRecruitCreateNotesResult>;

export function zohoRecruitCreateNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitCreateNotesRequest) =>
    context.fetchJson<ZohoRecruitCreateNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}`, zohoRecruitApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

export interface ZohoRecruitDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoRecruitNoteId>;
}

export type ZohoRecruitDeleteNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitDeleteNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitDeleteNotesFunction = (input: ZohoRecruitDeleteNotesRequest) => Promise<ZohoRecruitDeleteNotesResult>;

export function zohoRecruitDeleteNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitDeleteNotesRequest) =>
    context.fetchJson<ZohoRecruitDeleteNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}?${makeUrlSearchParams({ ids: input.ids })}`, zohoRecruitApiFetchJsonInput('DELETE')).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

export type ZohoRecruitGetNotesForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;
export type ZohoRecruitGetNotesForRecordResponse = ZohoPageResult<ZohoRecruitRecordNote>;
export type ZohoRecruitGetNotesForRecordFunction = (input: ZohoRecruitGetNotesForRecordRequest) => Promise<ZohoRecruitGetNotesForRecordResponse>;

export function zohoRecruitGetNotesForRecord(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordNote>({ targetModule: ZOHO_RECRUIT_NOTES_MODULE });
}

export type ZohoRecruitGetNotesForRecordPageFactory = FetchPageFactory<ZohoRecruitGetNotesForRecordRequest, ZohoRecruitGetNotesForRecordResponse>;

export function zohoRecruitGetNotesForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetNotesForRecord(context));
}

export interface ZohoRecruitCreateNotesForRecordRequest extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoRecruitNoteData, 'se_module' | 'Parent_Id'>>;
}

export type ZohoRecruitCreateNotesForRecordFunction = (input: ZohoRecruitCreateNotesForRecordRequest) => Promise<ZohoRecruitCreateNotesResult>;

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
