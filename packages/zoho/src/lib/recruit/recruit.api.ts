import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoAuthClientIdAndSecretPair, ZohoRefreshToken } from '../zoho.config';
import { Maybe, Seconds } from '@dereekb/util';
import { ZohoRecruitContext } from './recruit.config';
import { ZohoRecruitModuleName } from './recruit';

export interface ZohoRecruitGetRecordByIdInput {
  readonly module: ZohoRecruitModuleName;
}

export interface ZohoRecruitGetRecordByIdResponse {}

export interface ZohoRecruitGetRecordByIdErrorResponse {
  error: string;
}

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): (input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResponse> {
  return (input) =>
    context.fetchJson<ZohoRecruitGetRecordByIdResponse | ZohoRecruitGetRecordByIdErrorResponse>(`/recruit/private/json/${input.module}/getRecordById`, zohoRecruitApiFetchJsonInput('GET')).then((result) => {
      if ((result as ZohoRecruitGetRecordByIdErrorResponse)?.error) {
        throw new Error(); // TODO: ... //ZohoRecruitGetRecordByIdError((result as ZohoRecruitGetRecordByIdErrorResponse).error);
      }

      return result as ZohoRecruitGetRecordByIdResponse;
    });
}

export function zohoRecruitApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
