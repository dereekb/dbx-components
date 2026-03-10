import { map, type Observable } from 'rxjs';
import { type AllowedSet, isAllowed, maybeSet, type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type TransitionService, type TransitionHookFn, type Transition, type HookMatchCriteria } from '@uirouter/core';
import { type AuthUserState } from '../../../auth.user';
import { type DbxAuthService } from '../../../service/auth.service';
import { type AuthTransitionDecision, type AuthTransitionHookOptions, type AuthTransitionStateData, makeAuthTransitionHook } from './hook';

/**
 * Configuration for the {@link enableHasAuthStateHook} UIRouter transition hook.
 *
 * @see {@link AuthTransitionHookOptions} for redirect and timeout configuration.
 */
export interface HasAuthStateHookConfig {
  options: AuthTransitionHookOptions;
}

/**
 * Configuration for specifying which {@link AuthUserState} values are allowed or disallowed for a UIRouter state.
 *
 * Can be provided as:
 * - A single `AuthUserState` string (e.g., `'user'`)
 * - An array of `AuthUserState` strings (e.g., `['user', 'new']`)
 * - A {@link HasAuthStateObjectConfig} for fine-grained allowed/disallowed control
 *
 * @see {@link HasAuthStateData} for how this is used in UIRouter state data.
 */
export type HasAuthStateConfig = ArrayOrValue<AuthUserState> | HasAuthStateObjectConfig;

/**
 * Detailed configuration for specifying allowed and disallowed {@link AuthUserState} values.
 *
 * Provides more control than a simple array by supporting both allow-lists and deny-lists.
 * If a user's current auth state matches a disallowed state, the transition is rejected.
 *
 * @example
 * ```ts
 * const config: HasAuthStateObjectConfig = {
 *   allowedStates: ['user'],
 *   disallowedStates: ['none', 'error']
 * };
 * ```
 */
export interface HasAuthStateObjectConfig {
  /**
   * Auth user states that are permitted to access this route.
   * If specified, only users in one of these states can proceed.
   */
  allowedStates?: ArrayOrValue<AuthUserState>;

  /**
   * Auth user states that are explicitly forbidden from accessing this route.
   * If the user is in one of these states, the transition is rejected.
   */
  disallowedStates?: ArrayOrValue<AuthUserState>;
}

/**
 * UIRouter state `data` interface for states that require a specific {@link AuthUserState}.
 *
 * Attach this data to a UIRouter state definition to enforce auth-state-based access control.
 * The {@link enableHasAuthStateHook} checks this property on entering states.
 *
 * @example
 * ```ts
 * // In a UIRouter state definition:
 * {
 *   name: 'app.dashboard',
 *   url: '/dashboard',
 *   data: {
 *     authStates: ['user']
 *   } as HasAuthStateData,
 *   component: DashboardComponent
 * }
 * ```
 *
 * @see {@link enableHasAuthStateHook} for the hook that evaluates this data.
 */
export interface HasAuthStateData extends AuthTransitionStateData {
  /**
   * Configuration specifying which {@link AuthUserState} values are required or forbidden for this state.
   */
  authStates: HasAuthStateConfig;
}

/**
 * Registers a UIRouter transition hook that redirects users whose {@link AuthUserState} does not
 * satisfy the state's requirements.
 *
 * The hook fires on `onBefore` (priority 100) for any state whose `data` property has an
 * `authStates` value. It supports both allow-lists and deny-lists of auth user states.
 *
 * @param transitionService - The UIRouter `TransitionService` to register the hook with.
 * @param config - Configuration including redirect targets and timeout settings.
 *
 * @see {@link HasAuthStateData} for marking states with required auth states.
 * @see {@link HasAuthStateObjectConfig} for detailed allowed/disallowed configuration.
 * @see {@link makeAuthTransitionHook} for the underlying hook factory.
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
      const allowedStates: ParsedHasAuthStateConfig = toParsedHasAuthStateConfig(config);

      return authService.authUserState$.pipe(map((x) => isAllowed(x, allowedStates)));
    }
  });

  // Register the "requires auth" hook with the TransitionsService
  transitionService.onBefore(isSecureCriteria, assertHasAuthState, { priority: 100 });
}

// MARK: Utility
function toHasAuthStateObjectConfig(input: HasAuthStateConfig): HasAuthStateObjectConfig {
  const isString = typeof input === 'string';

  if (Array.isArray(input) || isString) {
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
