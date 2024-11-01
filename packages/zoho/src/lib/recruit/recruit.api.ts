import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoRecruitContext } from './recruit.config';
import { ZohoRecruitModuleName, ZohoRecruitRecordId } from './recruit';
import { ZohoGetApiResult } from '../zoho.type';

export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
  readonly id: ZohoRecruitRecordId;
}

// MARK: Get Reecord By Id
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

export interface ZohoRecruitGetRecordByIdResponse {
  // TODO: ...
}

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoGetApiResult<ZohoRecruitGetRecordByIdResponse>> {
  return (input) => context.fetchJson<ZohoGetApiResult<ZohoRecruitGetRecordByIdResponse>>(`/private/json/${input.module}/getRecordById?id=${input.id}`, zohoRecruitApiFetchJsonInput('GET'));
}

// MARK: Get Reecord By Id
export interface ZohoRecruitGetRecordsInput extends ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

export interface ZohoRecruitGetRecordsResponse {}

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function getRecords(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordsInput) => Promise<ZohoGetApiResult<ZohoRecruitGetRecordsResponse>> {
  return (input) => context.fetchJson<ZohoGetApiResult<ZohoRecruitGetRecordsResponse>>(`/recruit/private/json/${input.module}/getRecords`, zohoRecruitApiFetchJsonInput('GET'));
}

// MARK: Util
export function zohoRecruitApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
