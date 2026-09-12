import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DbxFirebaseOAuthLoginComponent, OIDC_LOGIN_SESSION_REJECTED_NOTICE } from './oauth.login.component';

const INTERACTION_UID = 'testinteraction';

/**
 * The container auto-submits the signed-in user's ID token. When the server answers 401 the token is one it
 * will never accept, so the only way forward is a fresh sign-in — a Retry with the same token would loop.
 */
describe('DbxFirebaseOAuthLoginComponent on a refused ID token', () => {
  let isLoggedIn: BehaviorSubject<boolean>;
  let logOut: ReturnType<typeof vi.fn>;
  let submitLogin: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<DbxFirebaseOAuthLoginComponent>;
  let component: DbxFirebaseOAuthLoginComponent;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function httpError(status: number): HttpErrorResponse {
    return new HttpErrorResponse({ status, statusText: 'test' });
  }

  beforeEach(() => {
    isLoggedIn = new BehaviorSubject<boolean>(true);
    logOut = vi.fn(() => {
      isLoggedIn.next(false);
      return Promise.resolve();
    });
    submitLogin = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterService, useValue: { params$: of({ uid: INTERACTION_UID }) } },
        { provide: DbxFirebaseAuthService, useValue: { isLoggedIn$: isLoggedIn.asObservable(), logOut } },
        { provide: DbxFirebaseOidcInteractionService, useValue: { submitLogin } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(DbxFirebaseOAuthLoginComponent);
    component = fixture.componentInstance;
    await detectChanges();
  }

  it('should sign out and surface the login UI with a notice when the server answers 401', async () => {
    submitLogin.mockReturnValue(throwError(() => httpError(401)));
    await createComponent();

    expect(submitLogin).toHaveBeenCalledWith(INTERACTION_UID);
    expect(logOut).toHaveBeenCalledTimes(1);
    expect(component.loginStateCaseSignal()).toBe('no_user');
    expect(component.notice()).toBe(OIDC_LOGIN_SESSION_REJECTED_NOTICE);
    expect(component.errorMessage()).toBeNull();
    // a retry would resubmit the refused token — the auto-submit must not have fired again either
    expect(submitLogin).toHaveBeenCalledTimes(1);
  });

  it('should keep the retryable error state for a non-401 failure', async () => {
    submitLogin.mockReturnValue(throwError(() => httpError(400)));
    await createComponent();

    expect(logOut).not.toHaveBeenCalled();
    expect(component.loginStateCaseSignal()).toBe('error');
    expect(component.errorMessage()).toBe('Failed to complete login. Please try again.');
    expect(component.notice()).toBeNull();
  });

  it('should fall back to the error state when the sign-out itself fails', async () => {
    // still logged in after a failed sign-out: landing back in `'user'` would re-fire the auto-submit
    logOut.mockReturnValue(Promise.reject(new Error('sign-out failed')));
    submitLogin.mockReturnValue(throwError(() => httpError(401)));
    await createComponent();

    expect(logOut).toHaveBeenCalledTimes(1);
    expect(component.loginStateCaseSignal()).toBe('error');
    expect(component.notice()).toBeNull();
    expect(submitLogin).toHaveBeenCalledTimes(1);
  });

  it('should clear the notice and resubmit once the user signs in again', async () => {
    submitLogin.mockReturnValueOnce(throwError(() => httpError(401))).mockReturnValueOnce(of({ redirectTo: undefined }));
    await createComponent();
    expect(component.notice()).toBe(OIDC_LOGIN_SESSION_REJECTED_NOTICE);

    isLoggedIn.next(true);
    await detectChanges();

    expect(submitLogin).toHaveBeenCalledTimes(2);
    expect(component.notice()).toBeNull();
  });
});

/**
 * On a warm client-side navigation `isLoggedIn` is already true while the uid route param is still
 * resolving. The container must not auto-submit until the uid is known — otherwise the submit errors with
 * "Missing interaction UID" and a later uid emission cannot recover it.
 */
describe('DbxFirebaseOAuthLoginComponent before the interaction uid resolves', () => {
  let params: BehaviorSubject<Record<string, unknown>>;
  let submitLogin: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<DbxFirebaseOAuthLoginComponent>;
  let component: DbxFirebaseOAuthLoginComponent;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    params = new BehaviorSubject<Record<string, unknown>>({});
    submitLogin = vi.fn(() => of({ redirectTo: undefined }));

    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterService, useValue: { params$: params.asObservable() } },
        { provide: DbxFirebaseAuthService, useValue: { isLoggedIn$: of(true), logOut: vi.fn() } },
        { provide: DbxFirebaseOidcInteractionService, useValue: { submitLogin } }
      ]
    });

    fixture = TestBed.createComponent(DbxFirebaseOAuthLoginComponent);
    component = fixture.componentInstance;
    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should hold in the loading state and not submit while the uid is absent', () => {
    expect(component.loginStateCaseSignal()).toBe('unknown');
    expect(submitLogin).not.toHaveBeenCalled();
  });

  it('should auto-submit once the uid arrives', async () => {
    expect(submitLogin).not.toHaveBeenCalled();

    params.next({ uid: 'lateuid' });
    await detectChanges();

    expect(submitLogin).toHaveBeenCalledWith('lateuid');
  });
});
