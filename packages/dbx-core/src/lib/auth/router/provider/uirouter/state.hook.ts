import { map, Observable } from 'rxjs';
import { AllowedSet, isAllowed, maybeSet, ArrayOrValue, Maybe } from '@dereekb/util';
import { TransitionService, TransitionHookFn, Transition, HookMatchCriteria } from '@uirouter/core';
import { AuthUserState } from '../../../auth.state';
import { DbxAuthService } from '../../../service/auth.service';
import { AuthTransitionDecision, AuthTransitionHookOptions, makeAuthTransitionHook } from './hook';

export interface HasAuthStateHookConfig {
  options: AuthTransitionHookOptions;
}

export type HasAuthStateConfig = ArrayOrValue<AuthUserState> | HasAuthStateObjectConfig;

export interface HasAuthStateObjectConfig {

  /**
   * Whether or not this state or any child state is considered "secure", which requires the user to be logged in.
   */
  allowedStates?: ArrayOrValue<AuthUserState>;

  /**
   * States that are not allowed. If the current state is this state, a rejection is returned.
   */
  disallowedStates?: ArrayOrValue<AuthUserState>;

}

export interface HasAuthStateData {

  /**
   * Configuration for the hasAuthStateHook.
   */
  authStates: HasAuthStateConfig;

}

/**
 * This hook redirects to the configured default state when a user:
 * 
 * - does not have an allowed state
 * - has a disallowed state
 */
export function enableHasAuthStateHook(transitionService: TransitionService, config: HasAuthStateHookConfig): void {

  // Matches if the destination state's data property has a truthy 'isSecure' property
  const isSecureCriteria: HookMatchCriteria = {
    entering: (state) => {
      const data = state?.data as Maybe<Partial<HasAuthStateData>>;
      const match = Boolean(data?.authStates);
      return match;
    }
  };

  const assertHasAuthState: TransitionHookFn = makeAuthTransitionHook({
    ...config.options,
    makeDecisionsObs(transition: Transition, authService: DbxAuthService): Observable<AuthTransitionDecision> {
      const targetState = transition.targetState();
      const data: HasAuthStateData = targetState.state().data;
      const config = toHasAuthStateObjectConfig(data.authStates);
      const parsed: ParsedHasAuthStateConfig = toParsedHasAuthStateConfig(config);

      return authService.authUserState$.pipe(
        map(x => isAllowed(x, parsed))
      );
    }
  });

  // Register the "requires auth" hook with the TransitionsService
  transitionService.onBefore(isSecureCriteria, assertHasAuthState, { priority: 100 });
}

// MARK: Utility
function toHasAuthStateObjectConfig(input: HasAuthStateConfig): HasAuthStateObjectConfig {
  const isString = typeof input === 'string';

  if ((Array.isArray(input) || isString)) {
    if (isString) {
      input = [input as AuthUserState];
    }

    return {
      allowedStates: input as AuthUserState[]
    };
  } else {
    return input as HasAuthStateObjectConfig;
  }
}

type ParsedHasAuthStateConfig = AllowedSet<AuthUserState>;

function toParsedHasAuthStateConfig(input: HasAuthStateObjectConfig): ParsedHasAuthStateConfig {
  return {
    allowed: maybeSet(input.allowedStates),
    disallowed: maybeSet(input.disallowedStates)
  };
}
