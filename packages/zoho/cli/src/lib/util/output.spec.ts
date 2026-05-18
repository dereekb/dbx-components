import { describe, it, expect } from 'vitest';
import { ZohoInvalidAuthorizationError, ZohoInvalidTokenError, ZohoServerFetchResponseError, ZohoTooManyRequestsError } from '@dereekb/zoho';
import { buildErrorOutput } from './output';

describe('buildErrorOutput()', () => {
  const dummyData = { code: 'INVALID_TOKEN', message: 'token expired' } as any;
  const dummyResponseData = {} as any;
  const dummyResponseError = {} as any;

  it('should map ZohoInvalidTokenError to TOKEN_EXPIRED code', () => {
    const result = buildErrorOutput(new ZohoInvalidTokenError(dummyData, dummyResponseData, dummyResponseError));
    expect(result.code).toBe('TOKEN_EXPIRED');
    expect(result.ok).toBe(false);
  });

  it('should map ZohoInvalidAuthorizationError to AUTH_ERROR code', () => {
    const result = buildErrorOutput(new ZohoInvalidAuthorizationError(dummyData, dummyResponseData, dummyResponseError));
    expect(result.code).toBe('AUTH_ERROR');
  });

  it('should map ZohoTooManyRequestsError to RATE_LIMITED code', () => {
    const result = buildErrorOutput(new ZohoTooManyRequestsError(dummyData, dummyResponseData, dummyResponseError));
    expect(result.code).toBe('RATE_LIMITED');
  });

  it('should map ZohoServerFetchResponseError to API_ERROR code', () => {
    const result = buildErrorOutput(new ZohoServerFetchResponseError(dummyData, dummyResponseData, dummyResponseError));
    expect(result.code).toBe('API_ERROR');
  });

  it('should fall back to the default mapper for unknown errors', () => {
    const result = buildErrorOutput(new Error('something else'));
    expect(result.ok).toBe(false);
  });
});
