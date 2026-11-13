import { describe, expect, it, vi } from 'vitest';
import { CliDownloadStalledError, CliDownloadTaskFailedError } from '@dereekb/dbx-cli';
import { MicrosoftGraphError } from '@dereekb/microsoft';
import { FetchResponseError } from '@dereekb/util/fetch';
import { isMsGraphCliTokenRejectedError, msGraphCliDownloadFailureClassifier, msGraphCliDownloadFailureClassify, msGraphCliReauthOnce } from './download.failure';
import { msGraphCliErrorOutput } from './output';

function graphError(status: number, code: string, headers: Record<string, string> = {}): MicrosoftGraphError {
  return new MicrosoftGraphError({ code, message: 'm' }, new FetchResponseError(new Response(null, { status, headers })));
}

describe('msGraphCliDownloadFailureClassifier', () => {
  it('maps Graph statuses to engine kinds with the CLI envelope codes', () => {
    // models: https://learn.microsoft.com/en-us/graph/errors — 401 InvalidAuthenticationToken, 403 accessDenied, 404 itemNotFound
    expect(msGraphCliDownloadFailureClassifier(graphError(401, 'InvalidAuthenticationToken'))).toEqual({ kind: 'fatal', code: 'TOKEN_REJECTED' });
    expect(msGraphCliDownloadFailureClassifier(graphError(403, 'accessDenied'))).toEqual({ kind: 'item', code: 'SCOPE_DENIED' });
    // models: B8 — a malware-flagged item answers 403 malwareDetected
    expect(msGraphCliDownloadFailureClassifier(graphError(403, 'malwareDetected'))).toEqual({ kind: 'item', code: 'SCOPE_DENIED' });
    expect(msGraphCliDownloadFailureClassifier(graphError(404, 'itemNotFound'))).toEqual({ kind: 'item', code: 'NOT_FOUND' });
    expect(msGraphCliDownloadFailureClassifier(graphError(400, 'invalidRequest'))).toEqual({ kind: 'item', code: 'API_ERROR' });
  });

  it('reads Retry-After for a throttle or an outage', () => {
    // models: B9/B10 — 429 TooManyRequests and 503 carry Retry-After in seconds
    expect(msGraphCliDownloadFailureClassifier(graphError(429, 'TooManyRequests', { 'Retry-After': '7' }))).toEqual({ kind: 'throttled', code: 'RATE_LIMITED', retryAfter: 7000 });
    expect(msGraphCliDownloadFailureClassifier(graphError(503, 'serviceNotAvailable', { 'Retry-After': '2' }))).toEqual({ kind: 'transient', code: 'SERVICE_UNAVAILABLE', retryAfter: 2000 });
    // models: C-b — Exchange answers UnknownError for an outage
    expect(msGraphCliDownloadFailureClassifier(graphError(400, 'UnknownError'))).toMatchObject({ kind: 'transient', code: 'SERVICE_UNAVAILABLE' });
  });

  it('leaves other errors to the dbx-cli default classifier', () => {
    expect(msGraphCliDownloadFailureClassifier(new Error('x'))).toBeUndefined();
    expect(msGraphCliDownloadFailureClassify(new CliDownloadStalledError(1000))).toEqual({ kind: 'transient', code: 'TIMEOUT' });
    expect(msGraphCliDownloadFailureClassify(new Error('x'))).toEqual({ kind: 'item', code: 'ERROR' });
  });
});

describe('msGraphCliErrorOutput() for the download engine', () => {
  it('maps a failed task through its cause, else its failure code', () => {
    expect(msGraphCliErrorOutput(new CliDownloadTaskFailedError({ kind: 'fatal', code: 'TOKEN_REJECTED' }, graphError(401, 'InvalidAuthenticationToken')))?.code).toBe('TOKEN_REJECTED');
    expect(msGraphCliErrorOutput(new CliDownloadTaskFailedError({ kind: 'fatal', code: 'DISK_FULL' }, new Error('no space')))?.code).toBe('DISK_FULL');
  });

  it('maps a non-Graph 429 to RATE_LIMITED', () => {
    // models: B9 — the download host throttles with a bare 429
    expect(msGraphCliErrorOutput(new FetchResponseError(new Response(null, { status: 429 })))?.code).toBe('RATE_LIMITED');
  });
});

describe('msGraphCliReauthOnce()', () => {
  it('resets the token once and retries on the first 401', async () => {
    const resetToken = vi.fn(async () => undefined);
    const reauth = msGraphCliReauthOnce({ resetToken });
    let calls = 0;

    const result = await reauth(async () => {
      calls += 1;

      if (calls === 1) {
        throw graphError(401, 'InvalidAuthenticationToken');
      }

      return 'ok';
    });

    expect(result).toBe('ok');
    expect(resetToken).toHaveBeenCalledTimes(1);
  });

  it('rethrows a 401 that repeats after the reset, and gives a later operation no retry', async () => {
    const resetToken = vi.fn(async () => undefined);
    const reauth = msGraphCliReauthOnce({ resetToken });
    const rejected = () => Promise.reject(graphError(401, 'InvalidAuthenticationToken'));

    await expect(reauth(rejected)).rejects.toBeInstanceOf(MicrosoftGraphError);
    await expect(reauth(rejected)).rejects.toBeInstanceOf(MicrosoftGraphError);
    expect(resetToken).toHaveBeenCalledTimes(1);
  });

  it('does not retry other errors, and recognizes a wrapped 401', async () => {
    const resetToken = vi.fn(async () => undefined);
    const reauth = msGraphCliReauthOnce({ resetToken });

    await expect(reauth(() => Promise.reject(graphError(404, 'itemNotFound')))).rejects.toBeInstanceOf(MicrosoftGraphError);
    expect(resetToken).not.toHaveBeenCalled();
    expect(isMsGraphCliTokenRejectedError(new CliDownloadTaskFailedError({ kind: 'fatal', code: 'TOKEN_REJECTED' }, graphError(401, 'InvalidAuthenticationToken')))).toBe(true);
  });
});
