import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { setCliVerbose } from '@dereekb/dbx-cli';
import { FetchResponseError } from '@dereekb/util/fetch';
import { ZohoAccountsAccessTokenError, ZohoAccountsAuthFailureError, ZohoCrmRecordNoContentError, ZohoInvalidAuthorizationError, ZohoInvalidTokenError, ZohoRecruitRecordNoContentError, ZohoServerFetchResponseError, ZohoTooManyRequestsError, parseZohoAnalyticsError, parseZohoCrmError, parseZohoDeskError, parseZohoRecruitError, parseZohoSignError } from '@dereekb/zoho';
import { buildErrorOutput, configureZohoCliOutput, isZohoCliTokenRejectedError, outputError, zohoCliServerErrorLogger } from './output';
import { exitZohoCliCommandWithError, getRecruitContext, setCliContext } from '../middleware/auth.middleware';
import type { ZohoCliContext } from '../context/cli.context';

function fetchResponseError(status: number, body: unknown): FetchResponseError {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new FetchResponseError(new Response(text, { status, headers: { 'Content-Type': 'application/json' } }));
}

const RECRUIT_INVALID_TOKEN_BODY = { code: 'INVALID_TOKEN', details: {}, message: 'invalid oauth token', status: 'error' };

describe('zoho-cli output', () => {
  beforeAll(() => {
    configureZohoCliOutput();
  });

  describe('buildErrorOutput()', () => {
    describe('TOKEN_REJECTED', () => {
      it('should map a Recruit 401 invalid token to TOKEN_REJECTED with httpStatus and serverCode', async () => {
        const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));
        expect(error).toBeInstanceOf(ZohoInvalidTokenError);

        const result = buildErrorOutput(error);
        expect(result).toMatchObject({ ok: false, code: 'TOKEN_REJECTED', httpStatus: 401, serverCode: 'INVALID_TOKEN', error: 'invalid oauth token' });
      });

      it('should map a CRM 401 invalid token to TOKEN_REJECTED', async () => {
        const error = await parseZohoCrmError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));
        expect(buildErrorOutput(error).code).toBe('TOKEN_REJECTED');
      });

      it('should map a Desk-shaped 401 (errorCode INVALID_OAUTH) to TOKEN_REJECTED', async () => {
        const error = await parseZohoDeskError(fetchResponseError(401, { errorCode: 'INVALID_OAUTH', message: 'The OAuth Token you provided is invalid.' }));
        const result = buildErrorOutput(error);

        expect(result).toMatchObject({ code: 'TOKEN_REJECTED', httpStatus: 401, serverCode: 'INVALID_OAUTH' });
        expect(isZohoCliTokenRejectedError(error)).toBe(true);
      });

      it('should map a Sign-shaped 401 (numeric code 9041) to TOKEN_REJECTED', async () => {
        const error = await parseZohoSignError(fetchResponseError(401, { code: 9041, message: 'Invalid Oauth token', status: 'failure' }));
        const result = buildErrorOutput(error);

        expect(result).toMatchObject({ code: 'TOKEN_REJECTED', httpStatus: 401, serverCode: '9041' });
      });

      it('should map an Analytics invalid token to TOKEN_REJECTED', async () => {
        const error = await parseZohoAnalyticsError(fetchResponseError(401, { status: 'failure', summary: 'INVALID_OAUTHTOKEN', data: { errorCode: 8535, errorMessage: 'Invalid OAuth token' } }));
        expect(buildErrorOutput(error).code).toBe('TOKEN_REJECTED');
      });

      it('should use the own-login suggestion by default and the token-source suggestion when asked', async () => {
        const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));

        expect(buildErrorOutput(error).suggestion).toContain('zoho-cli auth check');
        expect(buildErrorOutput(error, { tokenSource: true }).suggestion).toContain('zoho-cli auth token-source show');
      });
    });

    it('should map a 401 scope mismatch to SCOPE_DENIED, not TOKEN_REJECTED', async () => {
      const error = await parseZohoRecruitError(fetchResponseError(401, { code: 'OAUTH_SCOPE_MISMATCH', details: {}, message: 'invalid oauth scope to access this URL', status: 'error' }));
      const result = buildErrorOutput(error);

      expect(result).toMatchObject({ code: 'SCOPE_DENIED', httpStatus: 401, serverCode: 'OAUTH_SCOPE_MISMATCH' });
      expect(isZohoCliTokenRejectedError(error)).toBe(false);
    });

    it('should map a 403 to SCOPE_DENIED', async () => {
      const error = await parseZohoDeskError(fetchResponseError(403, { errorCode: 'FORBIDDEN', message: 'You do not have permission.' }));
      expect(buildErrorOutput(error).code).toBe('SCOPE_DENIED');
    });

    it('should map ZohoInvalidAuthorizationError to AUTH_ERROR', async () => {
      const error = await parseZohoRecruitError(fetchResponseError(401, { code: '4834', details: {}, message: 'Invalid Ticket Id', status: 'error' }));
      expect(error).toBeInstanceOf(ZohoInvalidAuthorizationError);
      expect(buildErrorOutput(error).code).toBe('AUTH_ERROR');
    });

    it('should map a refused token refresh to AUTH_ERROR', () => {
      expect(buildErrorOutput(new ZohoAccountsAuthFailureError('Token Refresh Failed')).code).toBe('AUTH_ERROR');
      expect(buildErrorOutput(new ZohoAccountsAccessTokenError('invalid_client'))).toMatchObject({ code: 'AUTH_ERROR', serverCode: 'invalid_client' });
    });

    it('should map a 429 to RATE_LIMITED', async () => {
      const error = await parseZohoDeskError(fetchResponseError(429, { errorCode: 'THROTTLE_LIMIT_EXCEEDED', message: 'Too many requests' }));
      expect(buildErrorOutput(error)).toMatchObject({ code: 'RATE_LIMITED', httpStatus: 429 });
    });

    it('should map ZohoTooManyRequestsError to RATE_LIMITED', () => {
      const error = new ZohoTooManyRequestsError({ code: 'TOO_MANY_REQUESTS', message: 'too many' }, {} as any, fetchResponseError(429, {}));
      expect(buildErrorOutput(error).code).toBe('RATE_LIMITED');
    });

    it('should map a 404 to NOT_FOUND', async () => {
      const error = await parseZohoRecruitError(fetchResponseError(404, { code: 'INVALID_URL_PATTERN', details: {}, message: 'Please check if the URL trying to access is a correct one', status: 'error' }));
      expect(buildErrorOutput(error)).toMatchObject({ code: 'NOT_FOUND', httpStatus: 404, serverCode: 'INVALID_URL_PATTERN' });
    });

    it('should map a record no-content error to NOT_FOUND', () => {
      expect(buildErrorOutput(new ZohoRecruitRecordNoContentError('Candidates', '1')).code).toBe('NOT_FOUND');
      expect(buildErrorOutput(new ZohoCrmRecordNoContentError('Leads', '1')).code).toBe('NOT_FOUND');
    });

    it('should map a 500 to SERVICE_UNAVAILABLE', async () => {
      const error = await parseZohoDeskError(fetchResponseError(500, { errorCode: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' }));
      expect(buildErrorOutput(error)).toMatchObject({ code: 'SERVICE_UNAVAILABLE', httpStatus: 500 });
    });

    it('should map an AbortError to TIMEOUT', () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      expect(buildErrorOutput(error).code).toBe('TIMEOUT');
    });

    it('should map any other Zoho server error to API_ERROR', () => {
      const error = new ZohoServerFetchResponseError({ code: 'DUPLICATE_DATA', message: 'duplicate data' }, {} as any, fetchResponseError(400, {}));
      expect(buildErrorOutput(error)).toMatchObject({ code: 'API_ERROR', httpStatus: 400, serverCode: 'DUPLICATE_DATA' });
    });

    it('should leave out httpStatus for an error reported in a 200 body', () => {
      const error = new ZohoServerFetchResponseError({ code: 'INVALID_DATA', message: 'invalid data' }, {} as any, fetchResponseError(200, {}));
      const result = buildErrorOutput(error);

      expect(result.code).toBe('API_ERROR');
      expect(result.httpStatus).toBeUndefined();
    });

    it('should sanitize secrets in the message', () => {
      const error = new ZohoServerFetchResponseError({ code: 'INVALID_DATA', message: 'bad refresh token 1000.abcdefghijklmnopqrstuvwxyz0123' }, {} as any, fetchResponseError(400, {}));
      expect(buildErrorOutput(error).error).not.toContain('1000.abcdefghijklmnopqrstuvwxyz0123');
    });

    it('should fall back to the default mapper for unknown errors', () => {
      const result = buildErrorOutput(new Error('something else'));
      expect(result).toMatchObject({ ok: false, code: 'ERROR', error: 'something else' });
    });
  });

  describe('zohoCliServerErrorLogger()', () => {
    afterEach(() => {
      setCliVerbose(false);
      vi.restoreAllMocks();
    });

    it('should never write to stdout, and write nothing without --verbose', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));

      zohoCliServerErrorLogger('recruit')(error as ZohoInvalidTokenError);

      expect(logSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('should write one stderr line under --verbose', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));
      setCliVerbose(true);

      zohoCliServerErrorLogger('recruit')(error as ZohoInvalidTokenError);

      expect(logSpy).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(String(stderrSpy.mock.calls[0][0])).toBe('[verbose] zoho-cli recruit: Zoho error 401 INVALID_TOKEN: invalid oauth token\n');
    });
  });

  describe('exitZohoCliCommandWithError()', () => {
    function fakeContext(order: string[]): ZohoCliContext {
      return {
        recruitContext: {} as any,
        crmContext: undefined,
        deskContext: undefined,
        signContext: undefined,
        analyticsContext: undefined,
        productAccounts: { recruit: {} as any, crm: undefined, desk: undefined, sign: undefined, analytics: undefined },
        tokenSource: { products: ['recruit'] } as any,
        resetCachedTokens: vi.fn(async () => {
          order.push('reset');
        })
      };
    }

    function spyExit(order: string[]) {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        order.push('print');
      });
      return { exitSpy, logSpy };
    }

    afterEach(() => {
      setCliContext(undefined);
      vi.restoreAllMocks();
    });

    it('should clear the requested products tokens before printing one TOKEN_REJECTED line, then exit 1', async () => {
      const order: string[] = [];
      const context = fakeContext(order);
      setCliContext(context);
      getRecruitContext({});
      const { exitSpy, logSpy } = spyExit(order);
      const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));

      await exitZohoCliCommandWithError(error);

      expect(context.resetCachedTokens).toHaveBeenCalledWith(['recruit']);
      expect(order).toEqual(['reset', 'print']);
      expect(logSpy).toHaveBeenCalledTimes(1);

      const printed = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(printed).toMatchObject({ ok: false, code: 'TOKEN_REJECTED', httpStatus: 401 });
      expect(printed.suggestion).toContain('token source');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should not reset on an error that is not a rejected token', async () => {
      const order: string[] = [];
      const context = fakeContext(order);
      setCliContext(context);
      getRecruitContext({});
      const { exitSpy } = spyExit(order);

      await exitZohoCliCommandWithError(new Error('boom'));

      expect(context.resetCachedTokens).not.toHaveBeenCalled();
      expect(order).toEqual(['print']);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should not reset when the command never requested a product', async () => {
      const order: string[] = [];
      const context = fakeContext(order);
      setCliContext(context);
      spyExit(order);
      const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));

      await exitZohoCliCommandWithError(error);

      expect(context.resetCachedTokens).not.toHaveBeenCalled();
    });

    it('should still print and exit 1 without a context (auth commands)', async () => {
      const order: string[] = [];
      const { exitSpy, logSpy } = spyExit(order);
      const error = await parseZohoRecruitError(fetchResponseError(401, RECRUIT_INVALID_TOKEN_BODY));

      await exitZohoCliCommandWithError(error);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(logSpy.mock.calls[0][0])).code).toBe('TOKEN_REJECTED');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('outputError()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should print exactly one JSON line', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      outputError(new Error('one line'));

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(logSpy.mock.calls[0][0]))).toMatchObject({ ok: false, error: 'one line' });
    });
  });
});
