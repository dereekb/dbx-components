import { DbxAuthService } from '../../../auth/service/auth.service';
import { type TransitionService, type TransitionHookFn, type Transition, type HookResult, type StateService, type HookMatchCriteria } from '@uirouter/core';
import { type Maybe, type ModelKey } from '@dereekb/util';
import { map, first, switchMap, firstValueFrom, type Observable, of } from 'rxjs';
import { type Injector } from '@angular/core';

/**
 * Default param value that indicates no specific identifier has been set, triggering a redirect to the default allowed identifier.
 */
export const DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_VALUE = '0';

/**
 * Default route parameter key used to read the model identifier from the URL.
 */
export const DEFAULT_REDIRECT_FOR_IDENTIFIER_PARAM_KEY = 'id';

/**
 * Configuration for the {@link redirectForIdentifierParamHook} function.
 *
 * Specifies how to read, validate, and redirect based on an identifier route parameter.
 * This is used with UIRouter's transition hooks to guard routes that require a valid model identifier.
 *
 * @example
 * ```ts
 * redirectForIdentifierParamHook({
 *   criteria: 'app.profile',
 *   transitionService,
 *   idParam: 'id',
 *   defaultAllowedValue: (authService) => authService.userIdentifier$,
 *   canViewModelWithId: (targetId, authService) => of(true)
 * });
 * ```
 *
 * @see {@link redirectForIdentifierParamHook}
 * @see {@link RedirectForUserIdentifierParamHookInput} for a user-specific variant
 */
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
 * Registers a UIRouter transition hook that asserts the user is allowed to view a route with an identifier as a state parameter.
 *
 * When a transition occurs to the target route:
 * 1. If the identifier param is missing or equals the default placeholder value, it redirects to the default allowed identifier.
 * 2. If the identifier differs from the default, it calls `canViewModelWithId` to verify access.
 * 3. If access is denied, it redirects to the default allowed identifier.
 *
 * @param input - Configuration specifying the route criteria, param key, and access control logic.
 *
 * @see {@link RedirectForIdentifierParamHookInput}
 * @see {@link redirectForUserIdentifierParamHook} for a user-specific convenience wrapper
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
                const result = x == null || typeof x === 'boolean' ? (x ? transitionTargetId : defaultAllowedIdValue) : x;
                return result;
              })
            );
          }

          if (redirectToId != null) {
            result = redirectToId.pipe(
              first(),
              map((targetId) => {
                const result = targetId !== transitionTargetId ? $state.target(transition.targetState().state(), { ...params, [idParam]: targetId }, { location: true }) : true;
                return result;
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
