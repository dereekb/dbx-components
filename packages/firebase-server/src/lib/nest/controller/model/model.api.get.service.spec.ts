import { HttpsError } from 'firebase-functions/https';
import { forbiddenError, notFoundError } from '../../../function/error';
import { modelAccessReadErrorFromUseMultipleModelsFailure } from './model.api.get.service';

describe('modelAccessReadErrorFromUseMultipleModelsFailure()', () => {
  it('unwraps HttpsError messages and codes from permission-denied failures', () => {
    const err = forbiddenError('forbidden');
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: err });

    expect(mapped.key).toBe('gb/abc');
    expect(mapped.message).toBe('forbidden');
    expect(mapped.code).toBe('FORBIDDEN');
  });

  it('uses the HttpsError.message when no details.message is present', () => {
    const err = new HttpsError('permission-denied', 'plain https message');
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: err });

    expect(mapped.message).toBe('plain https message');
    expect(mapped.code).toBe('permission-denied');
  });

  it('falls through to plain Error.message when not an HttpsError', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: new Error('boom') });

    expect(mapped.message).toBe('boom');
    expect(mapped.code).toBeUndefined();
  });

  it('returns a generic fallback when the error has neither a message nor a recognizable code', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: undefined });

    expect(mapped.message).toBe('unknown error');
    expect(mapped.code).toBeUndefined();
  });

  // A messageless HttpsError-shaped failure: `firebaseServerErrorInfo` classifies it (code + httpErrorCode
  // + toJSON) but no message survives, so the mapper must derive the message from the code — keeping
  // not-found distinct from permission-denied instead of conflating them.
  function messagelessHttpsError(input: { code: string; details?: { status: number; code: string } }): unknown {
    return { code: input.code, httpErrorCode: { status: input.code }, toJSON: () => ({}), ...(input.details ? { details: input.details } : {}) };
  }

  it('derives "not found" from the Firebase not-found code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'not-found' }) });

    expect(mapped.message).toBe('not found');
    expect(mapped.code).toBe('not-found');
  });

  it('derives "permission denied" from the Firebase permission-denied code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'permission-denied' }) });

    expect(mapped.message).toBe('permission denied');
    expect(mapped.code).toBe('permission-denied');
  });

  it('derives "not found" from the NOT_FOUND server error code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'internal', details: { status: 404, code: 'NOT_FOUND' } }) });

    expect(mapped.message).toBe('not found');
    expect(mapped.code).toBe('NOT_FOUND');
  });

  it('derives "permission denied" from the FORBIDDEN server error code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'internal', details: { status: 403, code: 'FORBIDDEN' } }) });

    expect(mapped.message).toBe('permission denied');
    expect(mapped.code).toBe('FORBIDDEN');
  });

  it('still prefers the real HttpsError message over the code-derived fallback', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: notFoundError('the document is gone') });

    expect(mapped.message).toBe('the document is gone');
    expect(mapped.code).toBe('NOT_FOUND');
  });
});
