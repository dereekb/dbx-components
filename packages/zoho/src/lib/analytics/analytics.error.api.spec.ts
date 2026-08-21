import { describe, it, expect } from 'vitest';
import { FetchResponseError } from '@dereekb/util/fetch';
import { ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError } from '../zoho.error.api';
import { ZohoAnalyticsMissingOrgIdError, type ZohoAnalyticsErrorResponseData, interceptZohoAnalytics200StatusWithErrorResponse, isZohoAnalyticsErrorResponseData, parseZohoAnalyticsServerErrorResponseData, zohoAnalyticsServerErrorData } from './analytics.error.api';

/**
 * Builds a {@link FetchResponseError} for the given status so error parsing can be exercised
 * without performing a request.
 */
function mockResponseError(status = 400): FetchResponseError {
  return new FetchResponseError(new Response(null, { status }));
}

/**
 * Builds a Zoho Analytics failure envelope for the given error code.
 */
function analyticsError(errorCode: number, errorMessage = 'Something went wrong', summary = 'SOME_SUMMARY'): ZohoAnalyticsErrorResponseData {
  return { status: 'failure', summary, data: { errorCode, errorMessage } };
}

describe('isZohoAnalyticsErrorResponseData()', () => {
  it('should identify a failure envelope', () => {
    expect(isZohoAnalyticsErrorResponseData(analyticsError(7101))).toBe(true);
  });

  it('should not identify a success envelope', () => {
    expect(isZohoAnalyticsErrorResponseData({ status: 'success', summary: 'Get all workspaces', data: {} })).toBe(false);
  });

  it('should not identify the { error } envelope used by the other Zoho services', () => {
    expect(isZohoAnalyticsErrorResponseData({ error: { code: 'INVALID_TOKEN', message: 'invalid' } })).toBe(false);
  });

  it('should not throw on null or a non-object', () => {
    expect(isZohoAnalyticsErrorResponseData(null)).toBe(false);
    expect(isZohoAnalyticsErrorResponseData('failure')).toBe(false);
  });
});

describe('zohoAnalyticsServerErrorData()', () => {
  it('should stringify the numeric error code and carry the message and summary', () => {
    const result = zohoAnalyticsServerErrorData(analyticsError(7101, 'Workspace exists', 'META_DBNAME_DUPLICATE'));

    expect(result.code).toBe('7101');
    expect(result.message).toBe('Workspace exists');
    expect(result.details?.summary).toBe('META_DBNAME_DUPLICATE');
  });

  it('should fall back to the summary when no error code or message is present', () => {
    const result = zohoAnalyticsServerErrorData({ status: 'failure', summary: 'META_DBNAME_DUPLICATE' });

    expect(result.code).toBe('META_DBNAME_DUPLICATE');
    expect(result.message).toBe('META_DBNAME_DUPLICATE');
  });
});

describe('parseZohoAnalyticsServerErrorResponseData()', () => {
  it('should parse error code 8535 as a ZohoInvalidTokenError so the cached token is reset', () => {
    const result = parseZohoAnalyticsServerErrorResponseData(analyticsError(8535, 'Invalid oauthtoken'), mockResponseError(401));

    expect(result).toBeInstanceOf(ZohoInvalidTokenError);
    expect((result as ZohoInvalidTokenError).code).toBe('8535');
  });

  it('should parse error code 8083 as a ZohoAnalyticsMissingOrgIdError', () => {
    const result = parseZohoAnalyticsServerErrorResponseData(analyticsError(8083, 'Organization id is not present in the request header'), mockResponseError());

    expect(result).toBeInstanceOf(ZohoAnalyticsMissingOrgIdError);
  });

  it('should parse the per-minute frequency code 6045 as a ZohoTooManyRequestsError', () => {
    const result = parseZohoAnalyticsServerErrorResponseData(analyticsError(6045, 'Too many requests'), mockResponseError());

    expect(result).toBeInstanceOf(ZohoTooManyRequestsError);
  });

  it('should parse the daily unit quota codes 6043 and 6044 as ZohoTooManyRequestsError', () => {
    expect(parseZohoAnalyticsServerErrorResponseData(analyticsError(6043), mockResponseError())).toBeInstanceOf(ZohoTooManyRequestsError);
    expect(parseZohoAnalyticsServerErrorResponseData(analyticsError(6044), mockResponseError())).toBeInstanceOf(ZohoTooManyRequestsError);
  });

  it('should parse an unrecognized code as a generic ZohoServerFetchResponseError', () => {
    const result = parseZohoAnalyticsServerErrorResponseData(analyticsError(7101), mockResponseError());

    expect(result).toBeInstanceOf(ZohoServerFetchResponseError);
    expect(result).not.toBeInstanceOf(ZohoInvalidTokenError);
    expect((result as ZohoServerFetchResponseError).code).toBe('7101');
  });

  it('should fall back to the shared parser for a non-Analytics error envelope', () => {
    const result = parseZohoAnalyticsServerErrorResponseData({ error: { code: 'INVALID_TOKEN', message: 'invalid' } }, mockResponseError(401));

    expect(result).toBeInstanceOf(ZohoInvalidTokenError);
  });
});

describe('interceptZohoAnalytics200StatusWithErrorResponse()', () => {
  it('should throw when a failure envelope is returned with a 200 status', () => {
    const json = analyticsError(7101, 'Workspace exists');

    expect(() => interceptZohoAnalytics200StatusWithErrorResponse(json, new Response(null, { status: 200 }))).toThrow(ZohoServerFetchResponseError);
  });

  it('should pass a success envelope through untouched', () => {
    const json = { status: 'success', summary: 'Get all workspaces', data: { ownedWorkspaces: [] } };

    expect(interceptZohoAnalytics200StatusWithErrorResponse(json, new Response(null, { status: 200 }))).toBe(json);
  });

  it('should pass a raw payload through untouched', () => {
    const json = [{ Region: 'East' }];

    expect(interceptZohoAnalytics200StatusWithErrorResponse(json, new Response(null, { status: 200 }))).toBe(json);
  });
});
