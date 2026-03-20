import { type AuthUserIdentifier } from '../../../auth/auth.user';
import { type DbxAuthService } from '../../../auth/service/auth.service';
import { type TransitionService, type HookMatchCriteria } from '@uirouter/core';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type Injector } from '@angular/core';
import { redirectForIdentifierParamHook } from './id.hook';

/**
 * Default param value that indicates no specific user identifier has been set, triggering a redirect to the authenticated user's identifier.
 */
export const DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_VALUE = '0';

/**
 * Default route parameter key used to read the user identifier from the URL.
 */
export const DEFAULT_REDIRECT_FOR_USER_IDENTIFIER_PARAM_KEY = 'uid';

/**
 * Configuration for the {@link redirectForUserIdentifierParamHook} function.
 *
 * A specialized variant of {@link RedirectForIdentifierParamHookInput} that defaults to reading the authenticated
 * user's identifier from {@link DbxAuthService} and uses the `uid` route parameter.
 *
 * @example
 * ```ts
 * redirectForUserIdentifierParamHook({
 *   criteria: 'app.user.profile',
 *   transitionService,
 *   canViewUser: (targetUid, authService) => of(true)
 * });
 * ```
 *
 * @see {@link redirectForUserIdentifierParamHook}
 * @see {@link redirectForIdentifierParamHook} for the underlying generic implementation
 */
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
 * Registers a UIRouter transition hook that asserts the current user is allowed to view a route parameterized by a user identifier.
 *
 * This is a convenience wrapper around {@link redirectForIdentifierParamHook} that automatically uses the
 * authenticated user's identifier from {@link DbxAuthService} as the default value when the `uid` param is
 * missing or matches the placeholder value.
 *
 * @param input - Configuration specifying the route criteria, access control logic, and optional parameter overrides.
 * @returns The result of registering the transition hook.
 *
 * @see {@link RedirectForUserIdentifierParamHookInput}
 * @see {@link redirectForIdentifierParamHook}
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
