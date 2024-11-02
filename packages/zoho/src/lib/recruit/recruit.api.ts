import { ZohoPageResult } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import { ZohoRecruitCommaSeparateFieldNames, ZohoRecruitCustomViewId, ZohoRecruitDraftOrSaveState, ZohoRecruitFieldName, ZohoRecruitModuleName, ZohoRecruitRecord, ZohoRecruitRecordId, ZohoRecruitTerritoryId, ZohoRecruitTrueFalseBoth } from './recruit';
import { SortingOrder } from '@dereekb/util';

export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

// MARK: Get Reecord By Id
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
}

export interface ZohoRecruitGetRecordByIdResponse {
  readonly data: ZohoRecruitRecord[];
}

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResponse> {
  return (input) => context.fetchJson<ZohoRecruitGetRecordByIdResponse>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'));
}

// MARK: Get Reecord By Id
export interface ZohoRecruitGetRecordsInput extends ZohoRecruitModuleNameRef {
  readonly fields?: ZohoRecruitCommaSeparateFieldNames;
  readonly sort_order?: SortingOrder;
  readonly sort_by?: ZohoRecruitFieldName;
  readonly converted?: ZohoRecruitTrueFalseBoth;
  readonly approved?: ZohoRecruitTrueFalseBoth;
  readonly page?: number;
  readonly per_page?: number;
  readonly cvid?: ZohoRecruitCustomViewId;
  readonly territory_id?: ZohoRecruitTerritoryId;
  readonly include_child?: boolean;
  readonly $state?: ZohoRecruitDraftOrSaveState;
}

export type ZohoRecruitGetRecordsResponse = ZohoPageResult<ZohoRecruitRecord>;

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function getRecords(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordsInput) => Promise<ZohoRecruitGetRecordsResponse> {
  return (input) => context.fetchJson<ZohoRecruitGetRecordsResponse>(`/v2/${input.module}`, zohoRecruitApiFetchJsonInput('GET'));
}

// MARK: Util
export function zohoRecruitApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
