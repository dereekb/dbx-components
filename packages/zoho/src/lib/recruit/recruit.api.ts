import { ZohoDataArrayResultRef, ZohoPageFilter, ZohoPageResult, zohoFetchPageFactory } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput, FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import {
  NewZohoRecruitNoteData,
  NewZohoRecruitRecordData,
  UpdateZohoRecruitRecordData,
  ZohoRecruitCommaSeparateFieldNames,
  ZohoRecruitCustomViewId,
  ZohoRecruitDraftOrSaveState,
  ZohoRecruitFieldName,
  ZohoRecruitModuleNameRef,
  ZohoRecruitChangeObjectDetails,
  ZohoRecruitRecord,
  ZohoRecruitRecordFieldsData,
  ZohoRecruitRecordId,
  ZohoRecruitRecordNote,
  ZohoRecruitSearchRecordsCriteriaTreeElement,
  ZohoRecruitTerritoryId,
  ZohoRecruitTrueFalseBoth,
  zohoRecruitSearchRecordsCriteriaString,
  ZohoRecruitNoteId
} from './recruit';
import { ArrayOrValue, EmailAddress, Maybe, PhoneNumber, SortingOrder, asArray } from '@dereekb/util';
import { assertRecordDataArrayResultHasContent, zohoRecruitRecordCrudError } from './recruit.error.api';
import { ZohoServerErrorDataWithDetails, ZohoServerErrorStatus, ZohoServerSuccessCode, ZohoServerSuccessStatus } from '../zoho.error.api';

// MARK: Insert/Update/Upsert Response
export type ZohoRecruitUpdateRecordResult<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitMultiRecordResult<RECORD_INPUT_TYPE, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;
export type ZohoRecruitUpdateRecordResponse = ZohoRecruitChangeObjectResponse;

export type ZohoRecruitUpdateRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE> | ZohoRecruitUpdateMultiRecordInput<RECORD_INPUT_TYPE>;

export interface ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> extends ZohoRecruitModuleNameRef {
  readonly data: RECORD_INPUT_TYPE;
}

export interface ZohoRecruitUpdateMultiRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> extends ZohoRecruitModuleNameRef {
  readonly data: RECORD_INPUT_TYPE[];
}

export type ZohoRecruitUpdateRecordLikeFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitUpdateMultiRecordFunction<RECORD_INPUT_TYPE> & ZohoRecruitUpdateSingleRecordFunction<RECORD_INPUT_TYPE>;
export type ZohoRecruitUpdateSingleRecordFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = (input: ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE>) => Promise<ZohoRecruitChangeObjectDetails>;
export type ZohoRecruitUpdateMultiRecordFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = (input: ZohoRecruitUpdateMultiRecordInput<RECORD_INPUT_TYPE>) => Promise<ZohoRecruitUpdateRecordResult<RECORD_INPUT_TYPE>>;

/**
 * The APIs for Insert, Upsert, and Update have the same structure.
 *
 * @returns
 */
function updateRecordLikeFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData>(context: ZohoRecruitContext, fetchUrlPrefix: '' | '/upsert', fetchMethod: 'POST' | 'PUT'): ZohoRecruitUpdateRecordLikeFunction<RECORD_INPUT_TYPE> {
  return (({ data, module }: ZohoRecruitUpdateRecordInput<RECORD_INPUT_TYPE>) =>
    context.fetchJson<ZohoRecruitUpdateRecordResponse>(`/v2/${module}${fetchUrlPrefix}`, zohoRecruitApiFetchJsonInput(fetchMethod, { data: asArray(data) })).then((x) => {
      const isInputMultipleItems = Array.isArray(data);
      const result = zohoRecruitMultiRecordResult<RECORD_INPUT_TYPE, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(data), x.data);

      if (isInputMultipleItems) {
        return result;
      } else {
        const { successItems, errorItems } = result;

        if (errorItems[0] != null) {
          throw zohoRecruitRecordCrudError(errorItems[0].result);
        } else {
          return successItems[0].result.details;
        }
      }
    })) as ZohoRecruitUpdateRecordLikeFunction<RECORD_INPUT_TYPE>;
}

// MARK: Insert Record
export type ZohoRecruitInsertRecordFunction = ZohoRecruitUpdateRecordLikeFunction<NewZohoRecruitRecordData>;

/**
 * Inserts one or more records into Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/insert-records.html
 *
 * @param context
 * @returns
 */
export function insertRecord(context: ZohoRecruitContext): ZohoRecruitInsertRecordFunction {
  return updateRecordLikeFunction(context, '', 'POST') as ZohoRecruitInsertRecordFunction;
}

// MARK: Upsert Record
export type ZohoRecruitUpsertRecordFunction = ZohoRecruitUpdateRecordLikeFunction<NewZohoRecruitRecordData | ZohoRecruitRecordFieldsData>;

/**
 * Updates or inserts one or more records in Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/upsert-records.html
 *
 * @param context
 * @returns
 */
export function upsertRecord(context: ZohoRecruitContext): ZohoRecruitUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoRecruitUpsertRecordFunction;
}

// MARK: Update Record
export type ZohoRecruitUpdateRecordFunction = ZohoRecruitUpdateRecordLikeFunction<UpdateZohoRecruitRecordData>;

/**
 * Updates one or more records in Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/update-records.html
 *
 * @param context
 * @returns
 */
export function updateRecord(context: ZohoRecruitContext): ZohoRecruitUpdateRecordFunction {
  return updateRecordLikeFunction<UpdateZohoRecruitRecordData>(context, '', 'PUT') as ZohoRecruitUpdateRecordFunction;
}

// MARK: Get Record By Id
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
}

export type ZohoRecruitGetRecordByIdResponse<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> = ZohoDataArrayResultRef<T>;

export type ZohoRecruitGetRecordByIdResult<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> = T;
export type ZohoRecruitGetRecordByIdFunction = <T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResult<T>>;

/**
 * Retrieves a specific record from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): ZohoRecruitGetRecordByIdFunction {
  return <T extends ZohoRecruitRecordFieldsData>(input: ZohoRecruitGetRecordByIdInput) =>
    context
      .fetchJson<ZohoRecruitGetRecordByIdResponse<T>>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'))
      .then(assertRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0]);
}

// MARK: Get Records
export interface ZohoRecruitGetRecordsPageFilter extends ZohoPageFilter {
  readonly converted?: ZohoRecruitTrueFalseBoth;
  readonly approved?: ZohoRecruitTrueFalseBoth;
}

export interface ZohoRecruitGetRecordsInput extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly fields?: ZohoRecruitCommaSeparateFieldNames;
  readonly sort_order?: SortingOrder;
  readonly sort_by?: ZohoRecruitFieldName;
  readonly cvid?: ZohoRecruitCustomViewId;
  readonly territory_id?: ZohoRecruitTerritoryId;
  readonly include_child?: boolean;
  readonly $state?: ZohoRecruitDraftOrSaveState;
}

export type ZohoRecruitGetRecordsResponse<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> = ZohoPageResult<T>;
export type ZohoRecruitGetRecordsFunction = <T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitGetRecordsInput) => Promise<ZohoRecruitGetRecordsResponse<T>>;

/**
 * Retrieves records from the given module. Used for paginating across all records.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function getRecords(context: ZohoRecruitContext): ZohoRecruitGetRecordsFunction {
  return ((input: ZohoRecruitGetRecordsInput) => context.fetchJson<ZohoRecruitGetRecordsResponse>(`/v2/${input.module}?${zohoRecruitUrlSearchParamsMinusModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET'))) as ZohoRecruitGetRecordsFunction;
}

// MARK: Search Reecords
/**
 * Configuration for searching records.
 *
 * Only criteria, email, phone, or word will be used at a single time.
 */
export interface ZohoRecruitSearchRecordsInput<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly criteria?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>;
  readonly email?: Maybe<EmailAddress>;
  readonly phone?: Maybe<PhoneNumber>;
  readonly word?: Maybe<string>;
}

export type ZohoRecruitSearchRecordsResponse<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> = ZohoRecruitGetRecordsResponse<T>;
export type ZohoRecruitSearchRecordsFunction = <T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => Promise<ZohoRecruitSearchRecordsResponse<T>>;

/**
 * Searches records from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * @param context
 * @returns
 */
export function searchRecords(context: ZohoRecruitContext): ZohoRecruitSearchRecordsFunction {
  function searchRecordsUrlSearchParams<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) {
    const baseInput = { ...input };
    delete baseInput.criteria;

    if (input.criteria != null) {
      const criteriaString = zohoRecruitSearchRecordsCriteriaString<T>(input.criteria);
      baseInput.criteria = criteriaString;
    }

    const urlParams = zohoRecruitUrlSearchParamsMinusModule(baseInput);
    return urlParams;
  }

  return (<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => context.fetchJson<ZohoRecruitSearchRecordsResponse<T>>(`/v2/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? { data: [], info: { more_records: false } })) as ZohoRecruitSearchRecordsFunction;
}

export type SearchRecordsPageFactory<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord> = FetchPageFactory<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>;

export function searchRecordsPageFactory<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(context: ZohoRecruitContext): SearchRecordsPageFactory<T> {
  return zohoFetchPageFactory(searchRecords(context));
}

// MARK: Notes
export interface ZohoRecruitCreateNotesRequest {
  readonly data: ZohoRecruitCreateNotesRequestEntry[];
}

export type ZohoRecruitCreateNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitCreateNotesRequestEntry = NewZohoRecruitNoteData;
export type ZohoRecruitCreateNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitCreateNotesFunction = (input: ZohoRecruitCreateNotesRequest) => Promise<ZohoRecruitCreateNotesResult>;

export function createNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitCreateNotesRequest) =>
    context.fetchJson<ZohoRecruitCreateNotesResponse>(`/v2/Notes`, zohoRecruitApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

export interface ZohoRecruitDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoRecruitNoteId>;
}

export type ZohoRecruitDeleteNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

export type ZohoRecruitDeleteNotesResponse = ZohoRecruitChangeObjectResponse;
export type ZohoRecruitDeleteNotesFunction = (input: ZohoRecruitDeleteNotesRequest) => Promise<ZohoRecruitDeleteNotesResult>;

export function deleteNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitDeleteNotesRequest) =>
    context.fetchJson<ZohoRecruitDeleteNotesResponse>(`/v2/Notes?${makeUrlSearchParams({ ids: input.ids })}`, zohoRecruitApiFetchJsonInput('DELETE')).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

export type ZohoRecruitGetNotesPageFilter = ZohoPageFilter;
export interface ZohoRecruitGetNotesForRecordRequest extends ZohoRecruitGetRecordByIdInput, ZohoRecruitGetNotesPageFilter {
  /**
   * @deprecated use variables on request instead of this filter.
   */
  readonly filter?: Maybe<ZohoRecruitGetNotesPageFilter>;
}

export type ZohoRecruitGetNotesForRecordResponse = ZohoPageResult<ZohoRecruitRecordNote>;
export type ZohoRecruitGetNotesForRecordFunction = (input: ZohoRecruitGetNotesForRecordRequest) => Promise<ZohoRecruitGetNotesForRecordResponse>;

export function getNotesForRecord(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordFunction {
  return (input: ZohoRecruitGetNotesForRecordRequest) => context.fetchJson<ZohoRecruitGetNotesForRecordResponse>(`/v2/${input.module}/${input.id}/Notes?${zohoRecruitUrlSearchParamsMinusIdAndModule(input, input.filter).toString()}`, zohoRecruitApiFetchJsonInput('GET'));
}

export type GetNotesForRecordPageFactory = FetchPageFactory<ZohoRecruitGetNotesForRecordRequest, ZohoRecruitGetNotesForRecordResponse>;

export function getNotesForRecordPageFactory(context: ZohoRecruitContext): GetNotesForRecordPageFactory {
  return zohoFetchPageFactory(getNotesForRecord(context));
}

export interface ZohoRecruitCreateNotesForRecordRequest extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoRecruitNoteData, 'se_module' | 'Parent_Id'>>;
}

export type ZohoRecruitCreateNotesForRecordFunction = (input: ZohoRecruitCreateNotesForRecordRequest) => Promise<ZohoRecruitCreateNotesResult>;

export function createNotesForRecord(context: ZohoRecruitContext): ZohoRecruitCreateNotesForRecordFunction {
  const createNotesInstance = createNotes(context);
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

// MARK: Util
export function zohoRecruitUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

export function zohoRecruitUrlSearchParamsMinusIdAndModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: ['id', 'module'] });
}

/**
 * @deprecated use makeUrlSearchParams instead.
 */
export const zohoRecruitUrlSearchParams = makeUrlSearchParams;

export function zohoRecruitApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}

// MARK: Results
export type ZohoRecruitChangeObjectResponse<T extends ZohoRecruitChangeObjectResponseEntry = ZohoRecruitChangeObjectResponseEntry> = ZohoDataArrayResultRef<T>;
export type ZohoRecruitChangeObjectResponseEntry<E extends ZohoRecruitChangeObjectResponseSuccessEntry = ZohoRecruitChangeObjectResponseSuccessEntry> = E | ZohoRecruitChangeObjectResponseErrorEntry;

export interface ZohoRecruitChangeObjectResponseSuccessEntry<D extends ZohoRecruitChangeObjectDetails = ZohoRecruitChangeObjectDetails> {
  readonly code: ZohoServerSuccessCode;
  readonly details: D;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

export interface ZohoRecruitChangeObjectResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

// MARK: Multi-Record Results
export interface ZohoRecruitMultiRecordResult<I, OS, OE> {
  readonly successItems: ZohoRecruitMultiRecordResultEntry<I, OS>[];
  readonly errorItems: ZohoRecruitMultiRecordResultEntry<I, OE>[];
}

export interface ZohoRecrutMultiRecordResultItem {
  readonly status: ZohoServerSuccessStatus | ZohoServerErrorStatus;
}

export function zohoRecruitMultiRecordResult<I, OS extends ZohoRecrutMultiRecordResultItem, OE extends ZohoRecrutMultiRecordResultItem>(input: I[], results: (OS | OE)[]): ZohoRecruitMultiRecordResult<I, OS, OE> {
  const successItems: ZohoRecruitMultiRecordResultEntry<I, OS>[] = [];
  const errorItems: ZohoRecruitMultiRecordResultEntry<I, OE>[] = [];

  input.forEach((x, i) => {
    const result = results[i];

    if (result.status === 'success') {
      successItems.push({
        input: x,
        result: result as OS
      });
    } else {
      errorItems.push({
        input: x,
        result: result as OE
      });
    }
  });

  const result: ZohoRecruitMultiRecordResult<I, OS, OE> = {
    successItems,
    errorItems
  };

  return result;
}

export interface ZohoRecruitMultiRecordResultEntry<I, O> {
  /**
   * Input record/data.
   */
  readonly input: I;
  /**
   * The result of the insert.
   */
  readonly result: O;
}

// MARK: COMPAT
/**
 * @deprecated use ZohoRecruitChangeObjectResponseEntry instead.
 */
export type ZohoRecruitUpdateRecordResponseEntry = ZohoRecruitChangeObjectResponseEntry;

/**
 * @deprecated use ZohoRecruitChangeObjectResponseSuccessEntry instead.
 */
export type ZohoRecruitUpdateRecordResponseSuccessEntry = ZohoRecruitChangeObjectResponseSuccessEntry;

/**
 * @deprecated use ZohoRecruitChangeObjectResponseErrorEntry instead.
 */
export type ZohoRecruitUpdateRecordResponseErrorEntry = ZohoRecruitChangeObjectResponseErrorEntry;
