import { DbxAuthService } from '../../../auth/service/auth.service';
import { TransitionService, TransitionHookFn, Transition, HookResult, StateService, HookMatchCriteria } from '@uirouter/core';
import { Maybe, ModelKey } from '@dereekb/util';
import { map, first, switchMap, firstValueFrom, Observable, of } from 'rxjs';
import { Injector } from '@angular/core';

export const DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_VALUE = '0';
export const DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_KEY = 'id';

export interface RedirectForIdentifierParamHookInput {
  /**
   * Factory that returns an observable that sends the default allowed identifier to use when accessing the resource.
   */
  readonly defaultAllowedValue: (authService: DbxAuthService, injector: Injector, transition: Transition) => Observable<ModelKey>;
  /**
   * Route parameter to use.
   *
   * Defaults to "uid"
   */
  readonly idParam?: string;
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
   * Whether or not the current user can view the target id.
   *
   * Can return another identifier, or true to allow access, or false/null/undefined to deny access.
   */
  readonly canViewModelWithId: (targetId: ModelKey, authService: DbxAuthService, injector: Injector) => Observable<Maybe<boolean | ModelKey>>;
  /**
   * Hook priority
   */
  readonly priority?: number;
}

/**
 * This hook asserts the user is allowed to view a route with an identifier as a state parameter.
 */
export function redirectForIdentifierParamHook(input: RedirectForIdentifierParamHookInput): void {
  const { defaultAllowedValue, idParam = DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_KEY, defaultParamValue = DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_VALUE, priority = 100, transitionService, canViewModelWithId: canViewUser } = input;
  const criteria: HookMatchCriteria = typeof input.criteria === 'string' ? { entering: input.criteria } : input.criteria;

  // https://ui-router.github.io/ng2/docs/latest/modules/transition.html#hookresult
  const assertAllowedId: TransitionHookFn = (transition: Transition): HookResult => {
    const $state: StateService = transition.router.stateService;
    const injector = transition.injector();
    const authService: DbxAuthService = injector.get(DbxAuthService);
    const params = transition.params();

    const transitionTargetId: Maybe<string> = params[idParam];
    const defaultAllowedValueObs$ = defaultAllowedValue(authService, injector, transition);

    return firstValueFrom(
      defaultAllowedValueObs$.pipe(
        first(),
        switchMap((defaultAllowedIdValue) => {
          let result: Observable<HookResult> = of(true);

          let redirectToId: Maybe<Observable<Maybe<ModelKey>>>;

          if (!transitionTargetId || transitionTargetId === defaultParamValue) {
            // If the param isn't set, default to the default value
            redirectToId = of(defaultAllowedIdValue);
          } else if (defaultAllowedIdValue !== transitionTargetId) {
            redirectToId = canViewUser(transitionTargetId, authService, injector).pipe(
              map((x) => {
                if (x == null || typeof x === 'boolean') {
                  return x ? transitionTargetId : defaultAllowedIdValue;
                } else {
                  return x;
                }
              })
            );
          }

          if (redirectToId != null) {
            result = redirectToId.pipe(
              first(),
              map((targetId) => {
                if (targetId !== transitionTargetId) {
                  const target = transition.targetState();
                  const state = target.state();
                  return $state.target(state, { ...params, [idParam]: targetId }, { location: true });
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
  transitionService.onBefore(criteria, assertAllowedId, { priority });
}
