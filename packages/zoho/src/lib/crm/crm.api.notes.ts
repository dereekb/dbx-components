import { type ZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';
import { type FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoCrmContext } from './crm.config';
import { ZOHO_CRM_NOTES_MODULE, type ZohoCrmModuleNameRef, type ZohoCrmRecordId } from './crm';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type ZohoCrmMultiRecordResult, type ZohoCrmChangeObjectResponseSuccessEntry, type ZohoCrmChangeObjectResponseErrorEntry, type ZohoCrmChangeObjectResponse, zohoCrmApiFetchJsonInput, zohoCrmMultiRecordResult, type ZohoCrmGetRelatedRecordsRequest, zohoCrmGetRelatedRecordsFunctionFactory } from './crm.api';
import { type NewZohoCrmNoteData, type ZohoCrmNoteId, type ZohoCrmRecordNote } from './crm.notes';

// MARK: Notes
export interface ZohoCrmCreateNotesRequest {
  readonly data: ZohoCrmCreateNotesRequestEntry[];
}

export type ZohoCrmCreateNotesResult = ZohoCrmMultiRecordResult<ZohoCrmCreateNotesRequestEntry, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;

export type ZohoCrmCreateNotesRequestEntry = NewZohoCrmNoteData;
export type ZohoCrmCreateNotesResponse = ZohoCrmChangeObjectResponse;
export type ZohoCrmCreateNotesFunction = (input: ZohoCrmCreateNotesRequest) => Promise<ZohoCrmCreateNotesResult>;

export function zohoCrmCreateNotes(context: ZohoCrmContext) {
  return (input: ZohoCrmCreateNotesRequest) =>
    context.fetchJson<ZohoCrmCreateNotesResponse>(`/v2/${ZOHO_CRM_NOTES_MODULE}`, zohoCrmApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoCrmMultiRecordResult<ZohoCrmCreateNotesRequestEntry, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

export interface ZohoCrmDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoCrmNoteId>;
}

export type ZohoCrmDeleteNotesResult = ZohoCrmMultiRecordResult<ZohoCrmNoteId, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;

export type ZohoCrmDeleteNotesResponse = ZohoCrmChangeObjectResponse;
export type ZohoCrmDeleteNotesFunction = (input: ZohoCrmDeleteNotesRequest) => Promise<ZohoCrmDeleteNotesResult>;

export function zohoCrmDeleteNotes(context: ZohoCrmContext) {
  return (input: ZohoCrmDeleteNotesRequest) =>
    context.fetchJson<ZohoCrmDeleteNotesResponse>(`/v2/${ZOHO_CRM_NOTES_MODULE}?${makeUrlSearchParams({ ids: input.ids })}`, zohoCrmApiFetchJsonInput('DELETE')).then((x) => {
      return zohoCrmMultiRecordResult<ZohoCrmNoteId, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

export type ZohoCrmGetNotesForRecordRequest = ZohoCrmGetRelatedRecordsRequest;
export type ZohoCrmGetNotesForRecordResponse = ZohoPageResult<ZohoCrmRecordNote>;
export type ZohoCrmGetNotesForRecordFunction = (input: ZohoCrmGetNotesForRecordRequest) => Promise<ZohoCrmGetNotesForRecordResponse>;

export function zohoCrmGetNotesForRecord(context: ZohoCrmContext): ZohoCrmGetNotesForRecordFunction {
  return zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordNote>({ targetModule: ZOHO_CRM_NOTES_MODULE });
}

export type ZohoCrmGetNotesForRecordPageFactory = FetchPageFactory<ZohoCrmGetNotesForRecordRequest, ZohoCrmGetNotesForRecordResponse>;

export function zohoCrmGetNotesForRecordPageFactory(context: ZohoCrmContext): ZohoCrmGetNotesForRecordPageFactory {
  return zohoFetchPageFactory(zohoCrmGetNotesForRecord(context));
}

export interface ZohoCrmCreateNotesForRecordRequest extends ZohoCrmModuleNameRef {
  readonly id: ZohoCrmRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoCrmNoteData, 'se_module' | 'Parent_Id'>>;
}

export type ZohoCrmCreateNotesForRecordFunction = (input: ZohoCrmCreateNotesForRecordRequest) => Promise<ZohoCrmCreateNotesResult>;

/**
 * https://www.zoho.com/crm/developer/docs/api/v8/create-notes.html
 *
 * @param context
 * @returns
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
