import { type TransitionHookFn, type Transition, type HookResult, type StateService, type UIInjector, type TransitionOptions, type RawParams } from '@uirouter/core';
import { catchError, map, first, firstValueFrom, type Observable, of, switchMap } from 'rxjs';
import { asSegueRef, asSegueRefString, type SegueRefOrSegueRefRouterLink } from './../../../../router/segue';
import { DbxAuthService } from '../../../service/auth.service';
import { type FactoryWithRequiredInput, getValueFromGetter, isGetter, type Maybe, type Milliseconds } from '@dereekb/util';
import { type Injector } from '@angular/core';
import { timeoutStartWith } from '@dereekb/rxjs';

/**
 * Represents the outcome of an auth transition decision in a UIRouter hook.
 *
 * Possible values:
 * - `true` - Allow the transition to proceed to the target state.
 * - `false` - Reject the transition and redirect to the configured default redirect target.
 * - `SegueRefOrSegueRefRouterLink` - Redirect to a specific route instead.
 *
 * @see {@link AuthTransitionHookConfig.makeDecisionsObs}
 */
export type AuthTransitionDecision = true | false | SegueRefOrSegueRefRouterLink;

/**
 * Input provided to an {@link AuthTransitionRedirectTargetGetter} when determining
 * where to redirect a user during an auth transition.
 *
 * Contains the current transition context, the Angular injector, and the auth service
 * for making authorization decisions.
 */
export interface AuthTransitionDecisionGetterInput {
  /**
   * The UIRouter transition that triggered the auth check.
   */
  readonly transition: Transition;
  /**
   * The Angular injector for resolving additional dependencies.
   */
  readonly injector: Injector;
  /**
   * The auth service for querying the current authentication state.
   */
  readonly authService: DbxAuthService;
}

/**
 * An observable that resolves to a redirect target (or `undefined` for no redirect).
 */
export type AuthTransitionRedirectTarget = Observable<Maybe<SegueRefOrSegueRefRouterLink>>;

/**
 * Factory function that produces an {@link AuthTransitionRedirectTarget} given the transition context.
 *
 * Used when the redirect destination needs to be computed dynamically based on the current
 * auth state, transition, or other runtime factors.
 */
export type AuthTransitionRedirectTargetGetter = FactoryWithRequiredInput<AuthTransitionRedirectTarget, AuthTransitionDecisionGetterInput>;

/**
 * A redirect target that can be either a static route reference, a dynamic getter, or `undefined`.
 *
 * @see {@link AuthTransitionRedirectTargetGetter} for the dynamic variant.
 */
export type AuthTransitionRedirectTargetOrGetter = Maybe<SegueRefOrSegueRefRouterLink> | AuthTransitionRedirectTargetGetter;

/**
 * Options shared by all auth transition hook configurations.
 *
 * Controls where users are redirected when auth checks fail and how long to wait
 * for the auth decision observable before timing out.
 */
export interface AuthTransitionHookOptions {
  /**
   * The UIRouter state name to redirect the user to when their auth check fails.
   */
  readonly defaultRedirectTarget: string;

  /**
   * The UIRouter state name to redirect to when an error occurs during the auth check.
   * Defaults to {@link defaultRedirectTarget} if not specified.
   */
  readonly errorRedirectTarget?: string;

  /**
   * Maximum time in milliseconds to wait for the decision observable to emit.
   * If the timeout is reached, the transition is treated as a `false` decision (redirect).
   *
   * @defaultValue 1000
   */
  timeoutTime?: Milliseconds;
}

/**
 * Full configuration for creating an auth transition hook via {@link makeAuthTransitionHook}.
 *
 * Extends {@link AuthTransitionHookOptions} with the decision-making observable factory.
 */
export interface AuthTransitionHookConfig extends AuthTransitionHookOptions {
  /**
   * Factory that creates the decision observable for a given transition.
   *
   * The observable should emit an {@link AuthTransitionDecision} value:
   * `true` to allow, `false` to redirect to the default target, or a route reference
   * to redirect to a specific location.
   */
  readonly makeDecisionsObs: (transition: Transition, authService: DbxAuthService, injector: UIInjector) => Observable<AuthTransitionDecision>;
}

/**
 * Interface for UIRouter state `data` that supports custom redirect logic on auth failure.
 *
 * When a state's auth check fails, the `redirectTo` property determines where the user
 * is sent. If not provided, the hook's `defaultRedirectTarget` is used.
 *
 * @see {@link AuthTransitionRedirectTargetOrGetter}
 */
export interface AuthTransitionStateData {
  /**
   * Optional static route reference or dynamic getter that determines the redirect destination
   * when the auth check for this state fails.
   */
  redirectTo?: AuthTransitionRedirectTargetOrGetter;
}

/**
 * Creates a UIRouter `TransitionHookFn` that performs auth-based route guarding.
 *
 * The generated hook evaluates the `makeDecisionsObs` observable for each transition:
 * - If it emits `true`, the transition proceeds normally.
 * - If it emits `false`, the user is redirected to the default target or a custom redirect
 *   specified in the state's `data.redirectTo` property.
 * - If it emits a route reference, the user is redirected to that specific route.
 * - If the observable does not emit within the configured timeout, the transition is rejected.
 *
 * @param config - The hook configuration including redirect targets and the decision observable factory.
 * @returns A `TransitionHookFn` suitable for registration with UIRouter's `TransitionService`.
 *
 * @see {@link enableIsLoggedInHook} for a login-based usage.
 * @see {@link enableHasAuthRoleHook} for a role-based usage.
 * @see {@link enableHasAuthStateHook} for a state-based usage.
 */
export function makeAuthTransitionHook(config: AuthTransitionHookConfig): TransitionHookFn {
  const { defaultRedirectTarget, errorRedirectTarget = defaultRedirectTarget, timeoutTime = 1000 } = config;

  // https://ui-router.github.io/ng2/docs/latest/modules/transition.html#hookresult
  const assertIsAuthenticated: TransitionHookFn = (transition: Transition): HookResult => {
    const injector = transition.injector();
    const authService: DbxAuthService = injector.get(DbxAuthService);
    const $state: StateService = transition.router.stateService;
    const decisionObs = config.makeDecisionsObs(transition, authService, injector);

    function redirectOut(): Observable<HookResult> {
      const stateData: AuthTransitionStateData = transition.targetState().state().data;
      const redirectTo = stateData?.redirectTo;

      let redirectToObs: Observable<HookResult>;

      if (redirectTo) {
        let resultObs: Observable<Maybe<SegueRefOrSegueRefRouterLink>>;

        if (isGetter<AuthTransitionRedirectTarget>(redirectTo)) {
          resultObs = getValueFromGetter(redirectTo, { authService, injector, transition } as AuthTransitionDecisionGetterInput);
        } else {
          resultObs = of(redirectTo as SegueRefOrSegueRefRouterLink);
        }

        redirectToObs = resultObs.pipe(
          map((inputStateRef: Maybe<SegueRefOrSegueRefRouterLink>) => {
            const stateRef = asSegueRef(inputStateRef);

            let redirectTarget;
            let redirectParams;

            if (stateRef) {
              redirectTarget = stateRef.ref;
              redirectParams = stateRef.refParams;
            }

            if (!redirectTarget) {
              redirectTarget = defaultRedirectTarget;
            }

            return $state.target(redirectTarget, redirectParams);
          })
        );
      } else {
        redirectToObs = of($state.target(defaultRedirectTarget));
      }

      return redirectToObs;
    }

    const resultObs = decisionObs.pipe(
      // after the timeoutTime seconds of no transition working, redirect with a false decision
      timeoutStartWith(false as AuthTransitionDecision, timeoutTime),
      first(),
      switchMap((decision: AuthTransitionDecision): Observable<HookResult> => {
        let result: Observable<HookResult>;

        if (typeof decision === 'boolean') {
          if (decision) {
            result = of(true);
          } else {
            result = redirectOut();
          }
        } else {
          const segueRef = asSegueRef(decision);
          result = of($state.target(asSegueRefString(segueRef.ref), segueRef.refParams as RawParams, segueRef.refOptions as TransitionOptions));
        }

        return result;
      }),
      catchError((x) => {
        console.warn(`Encountered error in auth transition hook. Attempting redirect to ${errorRedirectTarget}.`, x);
        return of($state.target(errorRedirectTarget, { location: true })); // Redirect to home
      })
    );

    return firstValueFrom(resultObs) as HookResult;
  };

  return assertIsAuthenticated;
}
