import { type Observable } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type TransitionService, type TransitionHookFn, type Transition, type HookMatchCriteria } from '@uirouter/core';
import { type DbxAuthService } from '../../../service/auth.service';
import { type AuthTransitionDecision, type AuthTransitionHookOptions, makeAuthTransitionHook } from './hook';

/**
 * Configuration for the {@link enableIsLoggedInHook} UIRouter transition hook.
 *
 * @see {@link AuthTransitionHookOptions} for redirect and timeout configuration.
 */
export interface IsLoggedInHookConfig {
  options: AuthTransitionHookOptions;
}

/**
 * UIRouter state `data` interface for states that require the user to be logged in.
 *
 * Attach this data to a UIRouter state definition to mark it as requiring authentication.
 * The {@link enableIsLoggedInHook} will check this property on entering states.
 *
 * @example
 * ```ts
 * // In a UIRouter state definition:
 * {
 *   name: 'app.dashboard',
 *   url: '/dashboard',
 *   data: { requiredLogIn: true } as IsLoggedInStateData,
 *   component: DashboardComponent
 * }
 * ```
 */
export interface IsLoggedInStateData {
  /**
   * Whether the user must be logged in to access this state.
   * When `true`, unauthenticated users will be redirected to the default redirect target.
   */
  requiredLogIn: boolean;
}

/**
 * Registers a UIRouter transition hook that redirects unauthenticated users away from
 * states that require login.
 *
 * The hook fires on `onBefore` (priority 100) for any state whose `data` property has
 * `requiredLogIn: true`. If the user is not logged in (as determined by {@link DbxAuthService.isLoggedIn$}),
 * they are redirected to the configured `defaultRedirectTarget`.
 *
 * @param transitionService - The UIRouter `TransitionService` to register the hook with.
 * @param config - Configuration including redirect targets and timeout settings.
 *
 * @see {@link IsLoggedInStateData} for marking states as requiring login.
 * @see {@link makeAuthTransitionHook} for the underlying hook factory.
 */
export function enableIsLoggedInHook(transitionService: TransitionService, config: IsLoggedInHookConfig): void {
  // Matches if the destination state's data property has a truthy 'isSecure' property
  const isSecureCriteria: HookMatchCriteria = {
    entering: (state) => {
      const data = state?.data as Maybe<Partial<IsLoggedInStateData>>;
      return Boolean(data?.requiredLogIn);
    }
  };

  const assertIsLoggedIn: TransitionHookFn = makeAuthTransitionHook({
    ...config.options,
    makeDecisionsObs(transition: Transition, authService: DbxAuthService): Observable<AuthTransitionDecision> {
      return authService.isLoggedIn$;
    }
  });

  // Register the "requires auth" hook with the TransitionsService
  transitionService.onBefore(isSecureCriteria, assertIsLoggedIn, { priority: 100 });
}
