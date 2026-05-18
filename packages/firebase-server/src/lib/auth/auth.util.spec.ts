import { describe, it, expect } from 'vitest';
import { getAuthUserOrUndefined } from './auth.util';
import { FIREBASE_AUTH_USER_NOT_FOUND_ERROR } from '@dereekb/firebase';
import type * as admin from 'firebase-admin';

describe('getAuthUserOrUndefined', () => {
  it('should return the user record when the promise resolves', async () => {
    const userRecord = { uid: 'test-user-id' } as admin.auth.UserRecord;
    const result = await getAuthUserOrUndefined(Promise.resolve(userRecord));
    expect(result).toBe(userRecord);
  });

  it('should return undefined when the promise rejects with auth/user-not-found', async () => {
    const error = { code: FIREBASE_AUTH_USER_NOT_FOUND_ERROR } as Error;
    const result = await getAuthUserOrUndefined(Promise.reject(error));
    expect(result).toBeUndefined();
  });

  it('should re-throw when the promise rejects with any other error', async () => {
    const error = { code: 'auth/some-other-error', message: 'boom' } as Error;
    await expect(getAuthUserOrUndefined(Promise.reject(error))).rejects.toEqual(error);
  });
});
