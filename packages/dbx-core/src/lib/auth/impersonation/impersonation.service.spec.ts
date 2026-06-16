import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, NEVER, Subject, firstValueFrom, of, type Observable } from 'rxjs';
import { type AuthRoleSet, type Maybe } from '@dereekb/util';
import { type AuthUserState, type AuthUserIdentifier, NO_AUTH_USER_IDENTIFIER } from '../auth.user';
import { DbxAuthService } from '../service';
import { DbxAuthImpersonationService } from './impersonation.service';
import { DbxAuthImpersonationDelegate, type DbxAuthImpersonationDetails } from './impersonation.details';
import { provideDbxAuthImpersonation } from './impersonation.providers';
import { type DbxAuthImpersonationEvent } from './impersonation.event';

const REAL_USER = 'realUser';
const OTHER_USER = 'otherUser';
const SECOND_USER = 'secondUser';

/**
 * Minimal controllable DbxAuthService for testing the impersonation service.
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

class TestImpersonationDelegate extends DbxAuthImpersonationDelegate<{ tag: string }> {
  loadImpersonationDetails(userId: AuthUserIdentifier): Observable<Maybe<DbxAuthImpersonationDetails<{ tag: string }>>> {
    return of({ userId, displayName: `name:${userId}`, raw: { tag: `raw:${userId}` } });
  }
}

function latestFrom<T>(obs: Observable<T>): T {
  let value: T;
  const sub = obs.subscribe((x) => (value = x));
  sub.unsubscribe();
  return value!;
}

describe('DbxAuthImpersonationService', () => {
  let auth: TestDbxAuthService;
  let service: DbxAuthImpersonationService;

  function setup(withDelegate = false) {
    auth = new TestDbxAuthService();
    TestBed.configureTestingModule({
      providers: [{ provide: DbxAuthService, useValue: auth }, provideDbxAuthImpersonation(withDelegate ? { delegateType: TestImpersonationDelegate } : undefined)]
    });
    service = TestBed.inject(DbxAuthImpersonationService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('without delegate', () => {
    beforeEach(() => setup(false));

    it('should fall back to the real user id when not impersonating', () => {
      expect(latestFrom(service.effectiveUserId$)).toBe(REAL_USER);
      expect(latestFrom(service.isImpersonating$)).toBe(false);
    });

    it('should impersonate a user and resolve the effective user id', () => {
      service.startImpersonating(OTHER_USER);
      expect(latestFrom(service.impersonatedUserId$)).toBe(OTHER_USER);
      expect(latestFrom(service.isImpersonating$)).toBe(true);
      expect(latestFrom(service.effectiveUserId$)).toBe(OTHER_USER);
    });

    it('should no-op when impersonating the sentinel or the real user', () => {
      service.startImpersonating(NO_AUTH_USER_IDENTIFIER);
      expect(latestFrom(service.isImpersonating$)).toBe(false);
      service.startImpersonating(REAL_USER);
      expect(latestFrom(service.isImpersonating$)).toBe(false);
    });

    it('should stop impersonating and revert to the real user', () => {
      service.startImpersonating(OTHER_USER);
      service.stopImpersonating();
      expect(latestFrom(service.isImpersonating$)).toBe(false);
      expect(latestFrom(service.effectiveUserId$)).toBe(REAL_USER);
    });

    it('should emit start/end events with previous ids, including a direct switch', () => {
      const events: DbxAuthImpersonationEvent[] = [];
      const sub = service.events$.subscribe((e) => events.push(e));

      service.startImpersonating(OTHER_USER);
      service.startImpersonating(SECOND_USER); // direct switch
      service.stopImpersonating();
      sub.unsubscribe();

      expect(events.length).toBe(3);
      expect(events[0]).toEqual({ type: 'start', impersonatedUserId: OTHER_USER, previousImpersonatedUserId: undefined, reason: 'manual' });
      expect(events[1]).toEqual({ type: 'start', impersonatedUserId: SECOND_USER, previousImpersonatedUserId: OTHER_USER, reason: 'manual' });
      expect(events[2]).toEqual({ type: 'end', impersonatedUserId: undefined, previousImpersonatedUserId: SECOND_USER, reason: 'manual' });
    });

    it('should auto-clear impersonation when the real identity changes', () => {
      service.startImpersonating(OTHER_USER);
      auth._userIdentifier.next('switchedAccount');
      expect(latestFrom(service.isImpersonating$)).toBe(false);
    });

    it('should auto-clear impersonation on logout', () => {
      service.startImpersonating(OTHER_USER);
      auth._onLogOut.next();
      expect(latestFrom(service.isImpersonating$)).toBe(false);
    });

    it('should emit undefined details when no delegate is configured', async () => {
      service.startImpersonating(OTHER_USER);
      const details = await firstValueFrom(service.impersonationDetails$);
      expect(details).toBeUndefined();
    });
  });

  describe('with delegate', () => {
    beforeEach(() => setup(true));

    it('should load details (including the raw payload) for the impersonated user', async () => {
      service.startImpersonating(OTHER_USER);
      const details = await firstValueFrom(service.impersonationDetails$);
      expect(details?.userId).toBe(OTHER_USER);
      expect(details?.displayName).toBe(`name:${OTHER_USER}`);
      expect((details?.raw as { tag: string }).tag).toBe(`raw:${OTHER_USER}`);
    });

    it('should emit undefined details when not impersonating', async () => {
      const details = await firstValueFrom(service.impersonationDetails$);
      expect(details).toBeUndefined();
    });
  });
});
