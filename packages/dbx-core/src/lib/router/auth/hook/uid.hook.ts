import { AuthUserIdentifier } from '../../../auth/auth.user';
import { DbxAuthService } from '../../../auth/service/auth.service';
import { TransitionService, HookMatchCriteria } from '@uirouter/core';
import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';
import { Injector } from '@angular/core';
import { redirectForIdentifierParamHook } from './id.hook';

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
 */
export function redirectForUserIdentifierParamHook(input: RedirectForUserIdentifierParamHookInput): void {
  const { uidParam = DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_KEY, defaultParamValue = DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_VALUE, criteria, priority = 100, transitionService, canViewUser } = input;

  return redirectForIdentifierParamHook({
    defaultAllowedValue: (authService: DbxAuthService) => authService.userIdentifier$,
    idParam: uidParam,
    defaultParamValue,
    criteria,
    transitionService,
    canViewModelWithId: canViewUser,
    priority
  });
}
