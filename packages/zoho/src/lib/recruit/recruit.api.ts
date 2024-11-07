import { ZohoDataArrayResultRef, ZohoPageResult } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import {
  NewZohoRecruitRecordData,
  UpdateZohoRecruitRecordData,
  ZohoRecruitCommaSeparateFieldNames,
  ZohoRecruitCustomViewId,
  ZohoRecruitDraftOrSaveState,
  ZohoRecruitFieldName,
  ZohoRecruitModuleName,
  ZohoRecruitRecord,
  ZohoRecruitRecordFieldsData,
  ZohoRecruitRecordId,
  ZohoRecruitRecordUpdateDetails,
  ZohoRecruitSearchRecordsCriteriaString,
  ZohoRecruitSearchRecordsCriteriaTree,
  ZohoRecruitSearchRecordsCriteriaTreeElement,
  ZohoRecruitTerritoryId,
  ZohoRecruitTrueFalseBoth,
  zohoRecruitSearchRecordsCriteriaString
} from './recruit';
import { EmailAddress, Maybe, PhoneNumber, SortingOrder, asArray } from '@dereekb/util';
import { assertRecordDataArrayResultHasContent, zohoRecruitRecordCrudError } from './recruit.error.api';
import { ZohoServerErrorDataWithDetails, ZohoServerErrorStatus, ZohoServerSuccessCode, ZohoServerSuccessStatus } from '../zoho.error.api';

export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

// MARK: Insert/Update/Upsert Response
export type ZohoRecruitUpdateRecordResult<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitMultiRecordResult<RECORD_INPUT_TYPE, ZohoRecruitUpdateRecordResponseSuccessEntry, ZohoRecruitUpdateRecordResponseErrorEntry>;

export type ZohoRecruitUpdateRecordResponse = ZohoDataArrayResultRef<ZohoRecruitUpdateRecordResponseEntry>;
export type ZohoRecruitUpdateRecordResponseEntry = ZohoRecruitUpdateRecordResponseSuccessEntry | ZohoRecruitUpdateRecordResponseErrorEntry;

export interface ZohoRecruitUpdateRecordResponseSuccessEntry {
  readonly code: ZohoServerSuccessCode;
  readonly details: ZohoRecruitRecordUpdateDetails;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

export interface ZohoRecruitUpdateRecordResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

export type ZohoRecruitUpdateRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE> | ZohoRecruitUpdateMultiRecordInput<RECORD_INPUT_TYPE>;

export interface ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> extends ZohoRecruitModuleNameRef {
  readonly data: RECORD_INPUT_TYPE;
}

export interface ZohoRecruitUpdateMultiRecordInput<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> extends ZohoRecruitModuleNameRef {
  readonly data: RECORD_INPUT_TYPE[];
}

export type ZohoRecruitUpdateRecordLikeFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = ZohoRecruitUpdateMultiRecordFunction<RECORD_INPUT_TYPE> & ZohoRecruitUpdateSingleRecordFunction<RECORD_INPUT_TYPE>;
export type ZohoRecruitUpdateSingleRecordFunction<RECORD_INPUT_TYPE extends ZohoRecruitRecordFieldsData> = (input: ZohoRecruitUpdateSingleRecordInput<RECORD_INPUT_TYPE>) => Promise<ZohoRecruitRecordUpdateDetails>;
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
      const result = zohoRecruitMultiRecordResult<RECORD_INPUT_TYPE, ZohoRecruitUpdateRecordResponseSuccessEntry, ZohoRecruitUpdateRecordResponseErrorEntry>(asArray(data), x.data);

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

export type ZohoRecruitGetRecordByIdResponse = ZohoDataArrayResultRef<ZohoRecruitRecord>;

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
      .fetchJson<ZohoRecruitGetRecordByIdResponse>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'))
      .then(assertRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0] as T);
}

// MARK: Get Records
export interface ZohoRecruitGetRecordsPageFilter {
  readonly converted?: ZohoRecruitTrueFalseBoth;
  readonly approved?: ZohoRecruitTrueFalseBoth;
  readonly page?: number;
  readonly per_page?: number;
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

  return (<T extends ZohoRecruitRecordFieldsData = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => context.fetchJson<ZohoRecruitSearchRecordsResponse>(`/v2/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? { data: [] })) as ZohoRecruitSearchRecordsFunction;
}

// MARK: Util
export function zohoRecruitUrlSearchParamsMinusModule(input: object | Record<string, string | number>) {
  const searchParams = new URLSearchParams(input as unknown as Record<string, string>);

  if (searchParams) {
    searchParams.delete('module');
  }

  return searchParams;
}

export function zohoRecruitApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
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

  let result: ZohoRecruitMultiRecordResult<I, OS, OE> = {
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
