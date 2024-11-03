import { ZohoDataArrayResultRef, ZohoPageResult } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import { ZohoRecruitCommaSeparateFieldNames, ZohoRecruitCustomViewId, ZohoRecruitDraftOrSaveState, ZohoRecruitFieldName, ZohoRecruitModuleName, ZohoRecruitRecord, ZohoRecruitRecordId, ZohoRecruitSearchRecordsCriteriaString, ZohoRecruitSearchRecordsCriteriaTree, ZohoRecruitTerritoryId, ZohoRecruitTrueFalseBoth } from './recruit';
import { EmailAddress, PhoneNumber, SortingOrder } from '@dereekb/util';
import { ZohoRecruitRecordNoContentError, assertRecordDataArrayResultHasContent } from './recruit.error.api';

export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

// MARK: Get Reecord By Id
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

// MARK: Get Reecords
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
