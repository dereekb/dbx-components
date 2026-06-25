import { TestBed } from '@angular/core/testing';
import { Component, Directive } from '@angular/core';
import { BehaviorSubject, NEVER, ReplaySubject, Subject, of, type Observable, type Subscription } from 'rxjs';
import { type AuthRoleSet, type Maybe, type ModelKey } from '@dereekb/util';
import { type AuthUserState, type AuthUserIdentifier } from '../../auth/auth.user';
import { DbxAuthService } from '../../auth';
import { DbxAuthImpersonationService, provideDbxAuthImpersonation } from '../../auth/impersonation';
import { completeOnDestroy } from '../../rxjs';
import { DbxRouteModelIdDirectiveDelegate, provideDbxRouteModelIdDirectiveDelegate } from './model.router';
import { DbxRouteModelIdFromAuthUserIdDirective } from './model.router.uid.directive';

const REAL_USER = 'realUser';
const OTHER_USER = 'otherUser';

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
 * Test delegate that captures the computed id observable the directive feeds it.
 */
@Directive({
  selector: '[dbxTestCaptureModelIdDelegate]',
  standalone: true,
  providers: provideDbxRouteModelIdDirectiveDelegate(TestCaptureModelIdDelegateDirective)
})
class TestCaptureModelIdDelegateDirective extends DbxRouteModelIdDirectiveDelegate {
  readonly captured = completeOnDestroy(new ReplaySubject<Maybe<ModelKey>>(1));

  useRouteModelIdParamsObservable(_idFromParamsObs: Observable<Maybe<ModelKey>>, computedIdObs: Observable<Maybe<ModelKey>>): Subscription {
    return computedIdObs.subscribe((value) => this.captured.next(value));
  }
}

@Component({
  template: `
    <div dbxRouteModelIdFromAuthUserId dbxTestCaptureModelIdDelegate></div>
  `,
  standalone: true,
  imports: [DbxRouteModelIdFromAuthUserIdDirective, TestCaptureModelIdDelegateDirective]
})
class TestHostComponent {}

@Component({
  template: `
    <div dbxRouteModelIdFromAuthUserId [ignoreAuthImpersonation]="true" dbxTestCaptureModelIdDelegate></div>
  `,
  standalone: true,
  imports: [DbxRouteModelIdFromAuthUserIdDirective, TestCaptureModelIdDelegateDirective]
})
class TestHostIgnoreImpersonationComponent {}

function latestFrom<T>(obs: Observable<T>): T {
  let value: T;
  const sub = obs.subscribe((x) => (value = x));
  sub.unsubscribe();
  return value!;
}

describe('DbxRouteModelIdFromAuthUserIdDirective', () => {
  let auth: TestDbxAuthService;

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function delegate(): TestCaptureModelIdDelegateDirective {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture.debugElement.children[0].injector.get(TestCaptureModelIdDelegateDirective);
  }

  describe('with impersonation provided', () => {
    let service: DbxAuthImpersonationService;

    function setup() {
      auth = new TestDbxAuthService();
      TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [{ provide: DbxAuthService, useValue: auth }, provideDbxAuthImpersonation()]
      });
      service = TestBed.inject(DbxAuthImpersonationService);
    }

    it('feeds the real user id when not impersonating', () => {
      setup();
      expect(latestFrom(delegate().captured)).toBe(REAL_USER);
    });

    it('feeds the impersonated (effective) user id while impersonating', () => {
      setup();
      const captured = delegate().captured;
      service.startImpersonating(OTHER_USER);
      expect(latestFrom(captured)).toBe(OTHER_USER);
    });

    it('ignores impersonation and uses the real user id when ignoreAuthImpersonation is set', () => {
      setup();
      service.startImpersonating(OTHER_USER);
      const fixture = TestBed.createComponent(TestHostIgnoreImpersonationComponent);
      fixture.detectChanges();
      const captured = fixture.debugElement.children[0].injector.get(TestCaptureModelIdDelegateDirective).captured;
      expect(latestFrom(captured)).toBe(REAL_USER);
    });
  });

  describe('without impersonation provided', () => {
    function setup() {
      auth = new TestDbxAuthService();
      TestBed.configureTestingModule({
        imports: [TestHostComponent],
        providers: [{ provide: DbxAuthService, useValue: auth }]
      });
    }

    it('falls back to the real user identifier', () => {
      setup();
      expect(latestFrom(delegate().captured)).toBe(REAL_USER);
    });
  });
});
