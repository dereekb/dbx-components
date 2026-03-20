import { map, type Observable, type OperatorFunction } from 'rxjs';
import { type AuthRole, type SetIncludesMode, type ArrayOrValue, type Maybe, setIncludes, asArray, type AuthRoleSet } from '@dereekb/util';
import { type TransitionService, type TransitionHookFn, type Transition, type HookMatchCriteria } from '@uirouter/core';
import { type DbxAuthService } from '../../../service/auth.service';
import { type AuthTransitionDecision, type AuthTransitionHookOptions, type AuthTransitionStateData, makeAuthTransitionHook } from './hook';

/**
 * Configuration for the {@link enableHasAuthRoleHook} UIRouter transition hook.
 *
 * @see {@link AuthTransitionHookOptions} for redirect and timeout configuration.
 */
export interface HasAuthRoleHookConfig {
  readonly options: AuthTransitionHookOptions;
}

/**
 * Configuration for specifying which auth roles are required for a state,
 * and how they should be evaluated.
 *
 * @see {@link HasAuthRoleStateData} for how this is used in UIRouter state data.
 */
export interface HasAuthRoleStateRoleConfig {
  /**
   * The auth role(s) required for this state. Can be a single role or an array of roles.
   */
  readonly authRoles: ArrayOrValue<AuthRole>;
  /**
   * How to evaluate the required roles against the user's role set.
   *
   * - `'all'` - User must have all specified roles (default).
   * - `'any'` - User must have at least one of the specified roles.
   */
  readonly authRolesMode?: SetIncludesMode;
}

/**
 * Parsed (internal) representation of a {@link HasAuthRoleStateRoleConfig}
 * where the roles have been converted to a `Set` for efficient lookup.
 */
export interface ParsedHasAuthRoleStateRoleConfig {
  /**
   * The set of auth roles required for this state.
   */
  readonly requiredRoles: Set<AuthRole>;
  /**
   * How to evaluate the required roles against the user's role set.
   *
   * @see {@link HasAuthRoleStateRoleConfig.authRolesMode}
   */
  readonly authRolesMode?: SetIncludesMode;
}

/**
 * UIRouter state `data` interface for states that require specific auth roles.
 *
 * Attach this data to a UIRouter state definition to enforce role-based access control.
 * The {@link enableHasAuthRoleHook} checks this property on entering states.
 *
 * @example
 * ```ts
 * // In a UIRouter state definition:
 * {
 *   name: 'app.admin',
 *   url: '/admin',
 *   data: {
 *     authRoles: ['admin'],
 *     authRolesMode: 'all'
 *   } as HasAuthRoleStateData,
 *   component: AdminComponent
 * }
 * ```
 *
 * @see {@link enableHasAuthRoleHook} for the hook that evaluates this data.
 */
export interface HasAuthRoleStateData extends AuthTransitionStateData, Pick<HasAuthRoleStateRoleConfig, 'authRolesMode'> {
  /**
   * Auth roles configuration for this state. Can be simple role string(s) or detailed
   * {@link HasAuthRoleStateRoleConfig} objects for per-group mode control.
   */
  readonly authRoles: ArrayOrValue<AuthRole | HasAuthRoleStateRoleConfig>;
}

/**
 * Registers a UIRouter transition hook that redirects users who lack the required auth roles
 * away from protected states.
 *
 * The hook fires on `onBefore` (priority 100) for any state whose `data` property has an
 * `authRoles` value. If the user's current roles do not satisfy the requirement
 * (based on the configured `authRolesMode`), they are redirected.
 *
 * @param transitionService - The UIRouter `TransitionService` to register the hook with.
 * @param config - Configuration including redirect targets and timeout settings.
 *
 * @see {@link HasAuthRoleStateData} for marking states with required roles.
 * @see {@link hasAuthRoleDecisionPipe} for the role evaluation logic.
 * @see {@link makeAuthTransitionHook} for the underlying hook factory.
 */
export function enableHasAuthRoleHook(transitionService: TransitionService, config: HasAuthRoleHookConfig): void {
  // Matches if the destination state's data property has a truthy 'isSecure' property
  const isSecureCriteria: HookMatchCriteria = {
    entering: (state) => {
      const data = state?.data as Maybe<Partial<HasAuthRoleStateData>>;
      return Boolean(data?.authRoles);
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

/**
 * Creates an RxJS operator that evaluates whether the user's {@link AuthRoleSet} satisfies
 * the role requirements defined in the given {@link HasAuthRoleStateData}.
 *
 * The operator processes role configurations and applies the specified `authRolesMode`
 * (`'all'` or `'any'`) to determine if the user has sufficient roles.
 *
 * @param stateData - The role configuration from the UIRouter state's `data` property.
 * @returns An `OperatorFunction` that transforms an `AuthRoleSet` stream into a `boolean` stream.
 *
 * @see {@link enableHasAuthRoleHook} for where this is used in transition hooks.
 */
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
    mapFn = map((x) => authRoleConfigs.some((y) => setIncludes(x, y.requiredRoles, y.authRolesMode))); // find the first match
  } else {
    mapFn = map((x) => !authRoleConfigs.some((y) => !setIncludes(x, y.requiredRoles, y.authRolesMode))); // find the first failed match
  }

  return mapFn;
}
