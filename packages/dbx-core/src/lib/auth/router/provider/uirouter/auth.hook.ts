import { Observable } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { TransitionService, TransitionHookFn, Transition, HookMatchCriteria } from '@uirouter/core';
import { DbxAuthService } from '../../../service/auth.service';
import { AuthTransitionDecision, AuthTransitionHookOptions, makeAuthTransitionHook } from './hook';

export interface IsLoggedInHookConfig {
  options: AuthTransitionHookOptions;
}

/**
 * UIRouter State data with configuration for the hasAuthRoleHook.
 */
export interface IsLoggedInStateData {

  /**
   * Whether or not the user needs to be logged in for this state.
   */
  requiredLogIn: boolean;

}

/**
 * This hook redirects to the configured default state when a user is not logged in for configured states.
 */
export function enableIsLoggedInHook(transitionService: TransitionService, config: IsLoggedInHookConfig): void {

  // Matches if the destination state's data property has a truthy 'isSecure' property
  const isSecureCriteria: HookMatchCriteria = {
    entering: (state) => {
      const data = state?.data as Maybe<Partial<IsLoggedInStateData>>;
      const match = Boolean(data?.requiredLogIn);
      return match;
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
