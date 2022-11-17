import { AuthUserIdentifier } from '../../../auth/auth.user';
import { DbxAuthService } from '../../../auth/service/auth.service';
import { TransitionService, TransitionHookFn, Transition, HookResult, StateService, HookMatchCriteria } from '@uirouter/core';
import { Maybe } from '@dereekb/util';
import { map, first, switchMap, firstValueFrom, Observable, of } from 'rxjs';
import { Injector } from '@angular/core';

export const DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_VALUE = '0';
export const DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_KEY = 'uid';

export interface RedirectForUserIdentifierParamHookInput {
  /**
   * Route parameter to use.
   *
   * Defaults to "uid"
   */
  readonly uidParam?: string;
  /**
   * The default param value to check against.
   *
   * Defaults to 0.
   */
  readonly defaultParamValue?: string;
  /**
   * Criteria or route to watch and intercept.
   */
  readonly criteria: HookMatchCriteria | string;
  readonly transitionService: TransitionService;
  /**
   * Whether or not the current user can view the target user.
   *
   * Can return another users identifier, or true to allow access, or false/null/undefined to deny access.
   */
  readonly canViewUser: (targetUid: AuthUserIdentifier, authService: DbxAuthService, injector: Injector) => Observable<Maybe<boolean | AuthUserIdentifier>>;
  /**
   * Hook priority
   */
  readonly priority?: number;
}

/**
 * This hook asserts the user is allowed to view a route with a user identifier as a parameter.
 *
 * If not, or
 */
export function redirectForUserIdentifierParamHook(input: RedirectForUserIdentifierParamHookInput): void {
  const { uidParam = DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_KEY, defaultParamValue = DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_VALUE, priority = 100, transitionService, canViewUser } = input;
  const criteria: HookMatchCriteria = typeof input.criteria === 'string' ? { entering: input.criteria } : input.criteria;

  // https://ui-router.github.io/ng2/docs/latest/modules/transition.html#hookresult
  const assertAllowedUid: TransitionHookFn = (transition: Transition): HookResult => {
    const $state: StateService = transition.router.stateService;
    const injector = transition.injector();
    const authService: DbxAuthService = injector.get(DbxAuthService);
    const params = transition.params();

    const transitionTargetUid: Maybe<string> = params[uidParam];

    return firstValueFrom(
      authService.userIdentifier$.pipe(
        first(),
        switchMap((currentUserId) => {
          let result: Observable<HookResult> = of(true);

          let redirectToUid: Maybe<Observable<Maybe<AuthUserIdentifier>>>;

          if (!transitionTargetUid || transitionTargetUid === defaultParamValue) {
            // If uid isn't set, default to the current user.
            redirectToUid = of(currentUserId);
          } else if (currentUserId !== transitionTargetUid) {
            redirectToUid = canViewUser(transitionTargetUid, authService, injector).pipe(
              map((x) => {
                if (x == null || typeof x === 'boolean') {
                  return x ? transitionTargetUid : currentUserId;
                } else {
                  return x;
                }
              })
            );
          }

          if (redirectToUid != null) {
            result = redirectToUid.pipe(
              first(),
              map((targetUid) => {
                if (targetUid !== transitionTargetUid) {
                  const target = transition.targetState();
                  const state = target.state();
                  return $state.target(state, { ...params, uid: targetUid }, { location: true });
                } else {
                  return true;
                }
              })
            );
          }

          return result;
        })
      )
    ) as HookResult;
  };

  // Register the "requires auth" hook with the TransitionsService
  transitionService.onBefore(criteria, assertAllowedUid, { priority });
}
