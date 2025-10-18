import { map, type Observable, type OperatorFunction } from 'rxjs';
import { type AuthRole, type SetIncludesMode, type ArrayOrValue, type Maybe, setIncludes, asArray, type AuthRoleSet } from '@dereekb/util';
import { type TransitionService, type TransitionHookFn, type Transition, type HookMatchCriteria } from '@uirouter/core';
import { type DbxAuthService } from '../../../service/auth.service';
import { type AuthTransitionDecision, type AuthTransitionHookOptions, type AuthTransitionStateData, makeAuthTransitionHook } from './hook';

export interface HasAuthRoleHookConfig {
  readonly options: AuthTransitionHookOptions;
}

export interface HasAuthRoleStateRoleConfig {
  /**
   * Auth roles marked for this state
   */
  readonly authRoles: ArrayOrValue<AuthRole>;
  /**
   * How to use the above auth roles. This defaults to 'all' by default.
   */
  readonly authRolesMode?: SetIncludesMode;
}

export interface ParsedHasAuthRoleStateRoleConfig {
  /**
   * Auth roles marked for this state
   */
  readonly requiredRoles: Set<AuthRole>;
  /**
   * How to use the above auth roles. This defaults to 'all' by default.
   */
  readonly authRolesMode?: SetIncludesMode;
}

/**
 * UIRouter State data with configuration for the hasAuthRoleHook.
 */
export interface HasAuthRoleStateData extends AuthTransitionStateData, Pick<HasAuthRoleStateRoleConfig, 'authRolesMode'> {
  /**
   * Auth roles configuration for this state.
   */
  readonly authRoles: ArrayOrValue<AuthRole | HasAuthRoleStateRoleConfig>;
}

/**
 * This hook redirects to the configured default state when a user:
 *
 * - does not have an allowed state
 * - has a disallowed state
 */
export function enableHasAuthRoleHook(transitionService: TransitionService, config: HasAuthRoleHookConfig): void {
  // Matches if the destination state's data property has a truthy 'isSecure' property
  const isSecureCriteria: HookMatchCriteria = {
    entering: (state) => {
      const data = state?.data as Maybe<Partial<HasAuthRoleStateData>>;
      const match = Boolean(data?.authRoles);
      return match;
    }
  };

  const assertHasAuthRole: TransitionHookFn = makeAuthTransitionHook({
    ...config.options,
    makeDecisionsObs(transition: Transition, authService: DbxAuthService): Observable<AuthTransitionDecision> {
      const targetState = transition.targetState();
      const data: HasAuthRoleStateData = targetState.state().data;
      const mapFn: OperatorFunction<AuthRoleSet, boolean> = hasAuthRoleDecisionPipe(data);
      return authService.authRoles$.pipe(mapFn);
    }
  });

  // Register the "requires auth" hook with the TransitionsService
  transitionService.onBefore(isSecureCriteria, assertHasAuthRole, { priority: 100 });
}

export function hasAuthRoleDecisionPipe(stateData: HasAuthRoleStateData): OperatorFunction<AuthRoleSet, boolean> {
  const authRolesMode: SetIncludesMode = stateData.authRolesMode || 'all';

  const authRoleConfigs: ParsedHasAuthRoleStateRoleConfig[] = asArray(stateData.authRoles).map((x) => {
    let config: HasAuthRoleStateRoleConfig;

    if (typeof x === 'string') {
      config = {
        authRoles: x,
        authRolesMode: 'any'
      };
    } else {
      config = x;
    }

    return {
      requiredRoles: new Set<AuthRole>(config.authRoles),
      authRolesMode: config.authRolesMode
    };
  });

  let mapFn: OperatorFunction<AuthRoleSet, boolean>;

  if (authRolesMode === 'any') {
    mapFn = map((x) => authRoleConfigs.findIndex((y) => setIncludes(x, y.requiredRoles, y.authRolesMode)) !== -1); // find the first match
  } else {
    mapFn = map((x) => authRoleConfigs.findIndex((y) => !setIncludes(x, y.requiredRoles, y.authRolesMode)) === -1); // find the first failed match
  }

  return mapFn;
}
