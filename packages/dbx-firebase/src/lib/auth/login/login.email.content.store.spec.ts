import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FIREBASE_AUTH_NETWORK_REQUEST_FAILED } from '@dereekb/firebase';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { DbxFirebaseLoginEmailContentStore } from './login.email.content.store';

const TEST_EMAIL = 'test@components.dereekb.com';

describe('DbxFirebaseLoginEmailContentStore', () => {
  let sendPasswordReset: Mock<(email: string) => Promise<void>>;
  let store: DbxFirebaseLoginEmailContentStore;

  beforeEach(() => {
    sendPasswordReset = vi.fn((_email: string) => Promise.resolve());

    TestBed.configureTestingModule({
      providers: [DbxFirebaseLoginEmailContentStore, { provide: DbxFirebaseAuthService, useValue: { sendPasswordReset } }]
    });

    store = TestBed.inject(DbxFirebaseLoginEmailContentStore);
  });

  it('should start on the login view', async () => {
    expect(await firstValueFrom(store.mode$)).toBe('login');
  });

  describe('setup()', () => {
    it('should seed the login and recovery forms from the default value', async () => {
      const passwordResetAnchor = { ref: 'app.reset' };
      store.setup({ passwordResetAnchor, defaultValue: { username: TEST_EMAIL, password: 'pass' } });

      expect(await firstValueFrom(store.emailFormValue$)).toEqual({ username: TEST_EMAIL, password: 'pass' });
      expect(await firstValueFrom(store.recoveryFormValue$)).toEqual({ email: TEST_EMAIL });
      expect(await firstValueFrom(store.passwordResetAnchor$)).toBe(passwordResetAnchor);
    });

    it('should not seed the recovery form when the default value has no username', async () => {
      store.setup({ defaultValue: { username: '', password: '' } });
      expect(await firstValueFrom(store.recoveryFormValue$)).toBeUndefined();
    });
  });

  describe('openRecovery()', () => {
    it('should show the recovery view, and returnToLogin() should show the login view again', async () => {
      store.openRecovery();
      expect(await firstValueFrom(store.mode$)).toBe('recover');

      store.returnToLogin();
      expect(await firstValueFrom(store.mode$)).toBe('login');
    });
  });

  describe('setEmailFormValue()', () => {
    it('should cache the username as the recovery email', async () => {
      store.setEmailFormValue({ username: TEST_EMAIL, password: 'pass' });
      expect(await firstValueFrom(store.recoveryFormValue$)).toEqual({ email: TEST_EMAIL });
    });
  });

  describe('sendPasswordReset()', () => {
    it('should send the reset email to the entered address and cache the entered value', async () => {
      await store.sendPasswordReset({ email: TEST_EMAIL });

      expect(sendPasswordReset).toHaveBeenCalledWith(TEST_EMAIL);
      expect(await firstValueFrom(store.recoveryFormValue$)).toEqual({ email: TEST_EMAIL });
      expect(await firstValueFrom(store.emailFormValue$)).toEqual({ username: TEST_EMAIL, password: '' });
    });

    it('should not change the view', async () => {
      store.openRecovery();
      await store.sendPasswordReset({ email: TEST_EMAIL });
      expect(await firstValueFrom(store.mode$)).toBe('recover');
    });

    it('should reject with a readable error when the send fails', async () => {
      sendPasswordReset.mockImplementation(() => Promise.reject({ code: FIREBASE_AUTH_NETWORK_REQUEST_FAILED }));

      await expect(store.sendPasswordReset({ email: TEST_EMAIL })).rejects.toMatchObject({
        code: FIREBASE_AUTH_NETWORK_REQUEST_FAILED,
        message: 'Could not reach the server. Are you connected to the internet?'
      });
    });
  });

  describe('markRecoverySent()', () => {
    it('should show the recovery sent view with the address the email was sent to', async () => {
      store.openRecovery();
      await store.sendPasswordReset({ email: TEST_EMAIL });
      store.markRecoverySent();

      expect(await firstValueFrom(store.mode$)).toBe('recoversent');
      expect(await firstValueFrom(store.recoveryEmailSentTo$)).toBe(TEST_EMAIL);
    });
  });
});
