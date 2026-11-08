import { describe, expect, it, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_READABLE_ERROR_CODE, isDefaultReadableError, readableError, ServerErrorResponse, toReadableError, UnauthorizedServerErrorResponse } from '@dereekb/util';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchServerErrorResponse, convertToPOJOServerErrorResponse, convertToServerErrorResponse, HTTP_ERROR_CODE, HTTP_NETWORK_ERROR_CODE, HTTP_NETWORK_ERROR_MESSAGE } from './error.api';

describe('convertToServerErrorResponse()', () => {
  it('should read the code, message and data of a JSON body', () => {
    const body = { code: 'NAME_TAKEN', message: 'That name is taken.', field: 'name' };
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 409, statusText: 'Conflict', error: body }));

    expect(result).toBeInstanceOf(ServerErrorResponse);
    expect(result?.code).toBe('NAME_TAKEN');
    expect(result?.message).toBe('That name is taken.');
    expect(result?.status).toBe(409);
    expect(result?.data).toEqual(body);
  });

  it('should use HTTP_ERROR_CODE when the JSON body has no code', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 400, error: { message: 'Bad input' } }));
    expect(result?.code).toBe(HTTP_ERROR_CODE);
    expect(result?.message).toBe('Bad input');
  });

  it('should use the body error string as the message when there is no message', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 409, error: { error: 'Name taken', code: 'X' } }));
    expect(result?.code).toBe('X');
    expect(result?.message).toBe('Name taken');
  });

  it('should not throw on a null body and should use the status text', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' }));
    expect(result?.code).toBe(HTTP_ERROR_CODE);
    expect(result?.message).toBe('Internal Server Error');
    expect(result?.status).toBe(500);
    expect(result?.data).toBeUndefined();
  });

  it('should ignore the OK placeholder status text', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 500, statusText: 'OK' }));
    expect(result?.message).toBe('Request failed with status 500.');
  });

  it('should convert a status-0 network failure', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(result?.code).toBe(HTTP_NETWORK_ERROR_CODE);
    expect(result?.message).toBe(HTTP_NETWORK_ERROR_MESSAGE);
    expect(result?.status).toBe(0);
    expect(result?.data).toBeUndefined();
  });

  it('should return an UnauthorizedServerErrorResponse for a 401 with an empty body', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 401 }));
    expect(result).toBeInstanceOf(UnauthorizedServerErrorResponse);
    expect(result?.status).toBe(401);
    expect(result?.message).toBe('Unauthorized');
    expect(result?.code).toBe(HTTP_ERROR_CODE);
  });

  it('should not use an HTML string body as the message or data', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 502, statusText: 'Bad Gateway', error: '<html><body>Bad Gateway</body></html>' }));
    expect(result?.message).toBe('Bad Gateway');
    expect(result?.data).toBeUndefined();
  });

  it('should return a ServerErrorResponse input unchanged', () => {
    const input = new ServerErrorResponse({ code: 'X', status: 418, message: 'Teapot' });
    expect(convertToServerErrorResponse(input)).toBe(input);
  });

  it('should convert a plain Error with the default code', () => {
    const result = convertToServerErrorResponse(new Error('Something broke'));
    expect(result?.code).toBe(DEFAULT_READABLE_ERROR_CODE);
    expect(result?.message).toBe('Something broke');
    expect(result?.status).toBe(0);
  });

  it('should return undefined for a falsy input', () => {
    expect(convertToServerErrorResponse(undefined as unknown as object)).toBeUndefined();
  });

  it('should keep the body message through toReadableError() for a code-less body', () => {
    const result = convertToServerErrorResponse(new HttpErrorResponse({ status: 422, error: { message: 'Invalid email' } }));
    const readable = toReadableError(result);

    expect(readable.message).toBe('Invalid email');
    expect(isDefaultReadableError(readable)).toBe(false);
  });
});

describe('convertToPOJOServerErrorResponse()', () => {
  it('should not throw for a body with data and should return a plain object', () => {
    const body = { code: 'BAD', message: 'Bad input', nested: { a: 1 } };
    const result = convertToPOJOServerErrorResponse(new HttpErrorResponse({ status: 400, error: body }));

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.code).toBe('BAD');
    expect(result.data).toEqual(body);
    expect(result.data).not.toBe(body);
  });

  it('should drop non-serializable data with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body: Record<string, unknown> = { code: 'CIRCULAR' };
    body['self'] = body;

    const result = convertToPOJOServerErrorResponse(new HttpErrorResponse({ status: 400, error: body }));

    expect(result.code).toBe('CIRCULAR');
    expect(result.data).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('catchServerErrorResponse()', () => {
  it('should rethrow an HttpErrorResponse as a ServerErrorResponse', async () => {
    const error = await firstValueFrom(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'BAD', message: 'Bad input' } })).pipe(catchServerErrorResponse())).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServerErrorResponse);
    expect((error as ServerErrorResponse).code).toBe('BAD');
    expect((error as ServerErrorResponse).message).toBe('Bad input');
  });

  it('should rethrow a non-HTTP error unchanged', async () => {
    const input = readableError('X', 'msg');
    const error = await firstValueFrom(throwError(() => input).pipe(catchServerErrorResponse())).catch((e: unknown) => e);
    expect(error).toBe(input);
  });

  it('should pass values through', async () => {
    const value = await firstValueFrom(of(1).pipe(catchServerErrorResponse<number>()));
    expect(value).toBe(1);
  });
});
