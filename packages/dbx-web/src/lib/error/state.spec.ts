import { describe, expect, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { createAction, props } from '@ngrx/store';
import { firstValueFrom, throwError } from 'rxjs';
import { catchErrorServerParams, convertServerErrorParams, type ServerErrorParams } from './state';

describe('convertServerErrorParams()', () => {
  it('should wrap a POJO error with its data for an error response with a body', () => {
    const body = { code: 'BAD', message: 'Bad input' };
    const result = convertServerErrorParams(new HttpErrorResponse({ status: 400, error: body }));

    expect(Object.getPrototypeOf(result.error)).toBe(Object.prototype);
    expect(result.error.code).toBe('BAD');
    expect(result.error.status).toBe(400);
    expect(result.error.data).toEqual(body);
  });
});

describe('catchErrorServerParams()', () => {
  it('should emit the failure action when the source errors with an error response with a body', async () => {
    const failed = createAction('[Test] Failed', props<ServerErrorParams>());
    const result = await firstValueFrom(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'BAD', message: 'Bad input' } })).pipe(catchErrorServerParams(failed)));

    expect(result.type).toBe('[Test] Failed');
    expect(result.error.code).toBe('BAD');
    expect(result.error.message).toBe('Bad input');
  });
});
