import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { BehaviorSubject, NEVER, Subject, of, type Observable } from 'rxjs';
import { type AuthRoleSet } from '@dereekb/util';
import { type AuthUserState, type AuthUserIdentifier, NO_AUTH_USER_IDENTIFIER } from '../auth.user';
import { DbxAuthService } from '../service';
import { DbxRouterService } from '../../router/router/service/router.service';
import { DbxAuthImpersonationService } from './impersonation.service';
import { provideDbxAuthImpersonation } from './impersonation.providers';
import { DbxAuthImpersonationQuerySyncDirective } from './impersonation.query.sync.directive';

const REAL_USER = 'realUser';
const OTHER_USER = 'otherUser';

/**
 * Minimal controllable DbxAuthService.
 */
class TestDbxAuthService implements DbxAuthService {
  readonly _userIdentifier = new BehaviorSubject<AuthUserIdentifier>(REAL_USER);
  readonly _onLogOut = new Subject<void>();

  readonly isLoggedIn$ = of(true);
  readonly isOnboarded$ = of(true);
  readonly onLogIn$: Observable<void> = NEVER;
  readonly onLogOut$: Observable<void> = this._onLogOut.asObservable();
  readonly authUserState$ = of<AuthUserState>('user');
  readonly authRoles$ = of<AuthRoleSet>(new Set());
  readonly userIdentifier$: Observable<AuthUserIdentifier> = this._userIdentifier.asObservable();

  async logOut(): Promise<void> {
    this._onLogOut.next();
  }
}

/**
 * Minimal controllable DbxRouterService exposing only the params$ the param reader consumes.
 */
class TestDbxRouterService {
  readonly _params = new BehaviorSubject<Record<string, unknown>>({});
  readonly params$ = this._params.asObservable();
}

@Component({
  template: `
    <div dbxAuthImpersonationQuerySync></div>
  `,
  standalone: true,
  imports: [DbxAuthImpersonationQuerySyncDirective]
})
class TestHostComponent {}

function latestFrom<T>(obs: Observable<T>): T {
  let value: T;
  const sub = obs.subscribe((x) => (value = x));
  sub.unsubscribe();
  return value!;
}

describe('DbxAuthImpersonationQuerySyncDirective', () => {
  let auth: TestDbxAuthService;
  let router: TestDbxRouterService;
  let service: DbxAuthImpersonationService;

  function setup() {
    auth = new TestDbxAuthService();
    router = new TestDbxRouterService();
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: DbxAuthService, useValue: auth }, { provide: DbxRouterService, useValue: router }, provideDbxAuthImpersonation()]
    });
    TestBed.createComponent(TestHostComponent).detectChanges();
    service = TestBed.inject(DbxAuthImpersonationService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts impersonating when ?imp names a different user', () => {
    setup();
    router._params.next({ imp: OTHER_USER });
    expect(latestFrom(service.isImpersonating$)).toBe(true);
    expect(latestFrom(service.effectiveUserId$)).toBe(OTHER_USER);
  });

  it('does not impersonate when ?imp is absent', () => {
    setup();
    router._params.next({});
    expect(latestFrom(service.isImpersonating$)).toBe(false);
    expect(latestFrom(service.effectiveUserId$)).toBe(REAL_USER);
  });

  it('does not impersonate the current user or the sentinel', () => {
    setup();
    router._params.next({ imp: REAL_USER });
    expect(latestFrom(service.isImpersonating$)).toBe(false);
    router._params.next({ imp: NO_AUTH_USER_IDENTIFIER });
    expect(latestFrom(service.isImpersonating$)).toBe(false);
  });

  it('stops impersonating when ?imp is removed', () => {
    setup();
    router._params.next({ imp: OTHER_USER });
    expect(latestFrom(service.isImpersonating$)).toBe(true);
    router._params.next({});
    expect(latestFrom(service.isImpersonating$)).toBe(false);
    expect(latestFrom(service.effectiveUserId$)).toBe(REAL_USER);
  });
});
