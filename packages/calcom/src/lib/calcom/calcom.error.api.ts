import { type FetchResponseError } from '@dereekb/util/fetch';
import { type CalcomServerErrorData, handleCalcomErrorFetchFactory, logCalcomServerErrorFunction, parseCalcomServerErrorData, type ParsedCalcomServerError } from '../calcom.error.api';

// MARK: Parser
export const logCalcomErrorToConsole = logCalcomServerErrorFunction('Calcom');

export async function parseCalcomApiError(responseError: FetchResponseError) {
  const data: CalcomServerErrorData | undefined = await responseError.response.json().catch((_x) => undefined);
  let result: ParsedCalcomServerError | undefined;

  if (data) {
    result = parseCalcomApiServerErrorResponseData(data, responseError);
  }

  return result;
}

export function parseCalcomApiServerErrorResponseData(calcomServerError: CalcomServerErrorData, responseError: FetchResponseError) {
  let result: ParsedCalcomServerError | undefined;

  if (calcomServerError) {
    switch (calcomServerError.code) {
      default:
        result = parseCalcomServerErrorData(calcomServerError, responseError);
        break;
    }
  }

  return result;
}

export const handleCalcomErrorFetch = handleCalcomErrorFetchFactory(parseCalcomApiError, logCalcomErrorToConsole);
