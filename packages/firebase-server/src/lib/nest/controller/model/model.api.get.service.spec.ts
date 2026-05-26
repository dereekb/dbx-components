import { HttpsError } from 'firebase-functions/https';
import { forbiddenError } from '../../../function/error';
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

  it('returns a useful fallback when the error has no message', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: undefined });

    expect(mapped.message).toBe('permission denied or not found');
    expect(mapped.code).toBeUndefined();
  });
});
