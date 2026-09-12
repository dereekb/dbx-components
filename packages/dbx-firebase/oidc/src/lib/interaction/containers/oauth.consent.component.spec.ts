import { Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DbxRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxFirebaseOidcInteractionService } from '../../service/oidc.interaction.service';
import { DbxFirebaseOidcConfigService } from '../../service/oidc.configuration.service';
import { AbstractDbxFirebaseOAuthConsentScopeViewComponent } from '../components/oauth.consent.scope.view.component';
import { DbxOAuthConsentComponent } from './oauth.consent.component';

const INTERACTION_UID = 'testinteraction';
const REQUESTED_SCOPES = 'openid profile email';

/**
 * Trivial stand-in for the consent scope list, so rendering the `'user'` state does not pull in the real
 * formly-backed default view (and its provider graph) for a test that only cares about the state signal.
 */
@Component({ template: '' })
class TestConsentScopeViewComponent extends AbstractDbxFirebaseOAuthConsentScopeViewComponent {}

/**
 * The consent form and its content pit render nothing useful until the interaction details load. The
 * container must stay in the loading state — rather than flash an empty consent screen — while the route
 * params are still resolving, which is what happens on a warm client-side navigation from the login screen
 * where `isLoggedIn` is already true.
 */
describe('DbxOAuthConsentComponent interaction readiness', () => {
  let params: BehaviorSubject<Record<string, unknown>>;
  let fixture: ComponentFixture<DbxOAuthConsentComponent>;
  let component: DbxOAuthConsentComponent;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(DbxOAuthConsentComponent);
    component = fixture.componentInstance;
    await detectChanges();
  }

  beforeEach(() => {
    params = new BehaviorSubject<Record<string, unknown>>({});

    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterService, useValue: { params$: params.asObservable() } },
        { provide: DbxFirebaseAuthService, useValue: { isLoggedIn$: of(true) } },
        { provide: DbxFirebaseOidcInteractionService, useValue: { submitConsent: vi.fn() } },
        { provide: DbxFirebaseOidcConfigService, useValue: { availableScopes: [], consentScopeListViewClass: TestConsentScopeViewComponent } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should hold in the loading state while the uid and scopes are absent', async () => {
    await createComponent();
    expect(component.consentStateCaseSignal()).toBe('unknown');
  });

  it('should hold in the loading state when only the uid has resolved', async () => {
    params.next({ uid: INTERACTION_UID });
    await createComponent();
    expect(component.consentStateCaseSignal()).toBe('unknown');
  });

  it('should reach the user state once the uid and scopes have both resolved', async () => {
    await createComponent();
    expect(component.consentStateCaseSignal()).toBe('unknown');

    params.next({ uid: INTERACTION_UID, scopes: REQUESTED_SCOPES });
    await detectChanges();

    expect(component.consentStateCaseSignal()).toBe('user');
    expect(component.interactionReadySignal()).toBe(true);
  });
});

/**
 * When the user is not signed in the login UI is projected regardless of the interaction params — they sign
 * in first, and the readiness gate applies only once auth resolves to a signed-in user.
 */
describe('DbxOAuthConsentComponent while signed out', () => {
  let fixture: ComponentFixture<DbxOAuthConsentComponent>;
  let component: DbxOAuthConsentComponent;

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should show the no_user state even with no interaction params', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DbxRouterService, useValue: { params$: of({}) } },
        { provide: DbxFirebaseAuthService, useValue: { isLoggedIn$: of(false) } },
        { provide: DbxFirebaseOidcInteractionService, useValue: { submitConsent: vi.fn() } },
        { provide: DbxFirebaseOidcConfigService, useValue: { availableScopes: [], consentScopeListViewClass: TestConsentScopeViewComponent } }
      ]
    });

    fixture = TestBed.createComponent(DbxOAuthConsentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.consentStateCaseSignal()).toBe('no_user');
  });
});
