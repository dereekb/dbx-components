import { ZohoDataArrayResultRef, ZohoPageResult } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import { ZohoNewRecruitRecord, ZohoRecruitCommaSeparateFieldNames, ZohoRecruitCustomViewId, ZohoRecruitDraftOrSaveState, ZohoRecruitFieldName, ZohoRecruitModuleName, ZohoRecruitRecord, ZohoRecruitRecordId, ZohoRecruitSearchRecordsCriteriaString, ZohoRecruitSearchRecordsCriteriaTree, ZohoRecruitTerritoryId, ZohoRecruitTrueFalseBoth } from './recruit';
import { EmailAddress, PhoneNumber, SortingOrder, asArray } from '@dereekb/util';
import { ZohoRecruitRecordCrudError, assertRecordDataArrayResultHasContent, zohoRecruitRecordCrudError } from './recruit.error.api';
import { ZohoServerErrorData, ZohoServerErrorDataWithDetails, ZohoServerErrorStatus, ZohoServerSuccessCode, ZohoServerSuccessStatus } from '../zoho.error.api';

export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

// MARK: Insert Record
export type ZohoRecruitInsertRecordInput = ZohoRecruitInsertSingleRecordInput | ZohoRecruitInsertMultiRecordInput;

export interface ZohoRecruitInsertSingleRecordInput extends ZohoRecruitModuleNameRef {
  readonly data: ZohoNewRecruitRecord;
}

export interface ZohoRecruitInsertMultiRecordInput extends ZohoRecruitModuleNameRef {
  readonly data: ZohoNewRecruitRecord[];
}

export type ZohoRecruitInsertRecordResponse = ZohoDataArrayResultRef<ZohoRecruitInsertRecordResponseEntry>;
export type ZohoRecruitInsertRecordResponseEntry = ZohoRecruitInsertRecordResponseSuccessEntry | ZohoRecruitInsertRecordResponseErrorEntry;

export interface ZohoRecruitInsertRecordResponseSuccessEntry {
  readonly code: ZohoServerSuccessCode;
  readonly details: ZohoRecruitRecord;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

export interface ZohoRecruitInsertRecordResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

export type ZohoRecruitInsertRecordResult = ZohoRecruitMultiRecordResult<ZohoNewRecruitRecord, ZohoRecruitInsertRecordResponseSuccessEntry, ZohoRecruitInsertRecordResponseErrorEntry>;

export type ZohoRecruitInsertRecordFunction = ZohoRecruitInsertSingleRecordFunction & ZohoRecruitInsertMultiRecordFunction;

export type ZohoRecruitInsertSingleRecordFunction = (input: ZohoRecruitInsertSingleRecordInput) => Promise<ZohoRecruitRecord>;
export type ZohoRecruitInsertMultiRecordFunction = (input: ZohoRecruitInsertMultiRecordInput) => Promise<ZohoRecruitInsertRecordResult>;

/**
 * Retrieves a specific record from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/insert-records.html
 *
 * @param context
 * @returns
 */
export function insertRecord(context: ZohoRecruitContext): ZohoRecruitInsertRecordFunction {
  return (({ data, module }: ZohoRecruitInsertRecordInput) =>
    context.fetchJson<ZohoRecruitInsertRecordResponse>(`/v2/${module}`, zohoRecruitApiFetchJsonInput('POST', { data: asArray(data) })).then((x) => {
      const isInputMultipleItems = Array.isArray(data);
      const result = zohoRecruitMultiRecordResult<ZohoNewRecruitRecord, ZohoRecruitInsertRecordResponseSuccessEntry, ZohoRecruitInsertRecordResponseErrorEntry>(asArray(data), x.data);

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
    })) as ZohoRecruitInsertRecordFunction;
}

// MARK: Get Record By Id
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
}

export type ZohoRecruitGetRecordByIdResponse = ZohoDataArrayResultRef<ZohoRecruitRecord>;

export type ZohoRecruitGetRecordByIdResult = ZohoRecruitRecord;

/**
 * Retrieves a specific record from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResult> {
  return (input) =>
    context
      .fetchJson<ZohoRecruitGetRecordByIdResponse>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'))
      .then(assertRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0]);
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

export type ZohoRecruitGetRecordsResponse = ZohoPageResult<ZohoRecruitRecord>;

/**
 * Retrieves records from the given module. Used for paginating across all records.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function getRecords(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordsInput) => Promise<ZohoRecruitGetRecordsResponse> {
  return (input) => context.fetchJson<ZohoRecruitGetRecordsResponse>(`/v2/${input.module}?${zohoRecruitUrlSearchParamsMinusModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET'));
}

// MARK: Search Reecords
/**
 * Configuration for searching records.
 *
 * Only criteria, email, phone, or word will be used at a single time.
 */
export interface ZohoRecruitSearchRecordsInput extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly criteria?: ZohoRecruitSearchRecordsCriteriaString | ZohoRecruitSearchRecordsCriteriaTree;
  readonly email?: EmailAddress;
  readonly phone?: PhoneNumber;
  readonly word?: string;
}

export type ZohoRecruitSearchRecordsResponse = ZohoRecruitGetRecordsResponse;

/**
 * Searches records from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * @param context
 * @returns
 */
export function searchRecords(context: ZohoRecruitContext): (input: ZohoRecruitSearchRecordsInput) => Promise<ZohoRecruitSearchRecordsResponse> {
  return (input) => context.fetchJson<ZohoRecruitSearchRecordsResponse>(`/v2/${input.module}/search?${zohoRecruitUrlSearchParamsMinusModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then(assertRecordDataArrayResultHasContent(input.module));
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
