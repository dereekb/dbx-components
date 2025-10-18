import { type TransitionHookFn, type Transition, type HookResult, type StateService, type UIInjector, type TransitionOptions, type RawParams } from '@uirouter/core';
import { catchError, map, first, firstValueFrom, type Observable, of, switchMap } from 'rxjs';
import { asSegueRef, asSegueRefString, type SegueRefOrSegueRefRouterLink } from './../../../../router/segue';
import { DbxAuthService } from '../../../service/auth.service';
import { type FactoryWithRequiredInput, getValueFromGetter, isGetter, type Maybe, type Milliseconds } from '@dereekb/util';
import { type Injector } from '@angular/core';
import { timeoutStartWith } from '@dereekb/rxjs';

/**
 * authTransitionHookFn() configuration. The values are handled as:
 * - true: continue to the state.
 * - false: redirect to the login page.
 * - StateOrName: redirect to the target page instead.
 */
export type AuthTransitionDecision = true | false | SegueRefOrSegueRefRouterLink;

export interface AuthTransitionDecisionGetterInput {
  readonly transition: Transition;
  readonly injector: Injector;
  readonly authService: DbxAuthService;
}

export type AuthTransitionRedirectTarget = Observable<Maybe<SegueRefOrSegueRefRouterLink>>;
export type AuthTransitionRedirectTargetGetter = FactoryWithRequiredInput<AuthTransitionRedirectTarget, AuthTransitionDecisionGetterInput>;
export type AuthTransitionRedirectTargetOrGetter = Maybe<SegueRefOrSegueRefRouterLink> | AuthTransitionRedirectTargetGetter;

export interface AuthTransitionHookOptions {
  /**
   * The state to redirect the user to when their auth fails.
   */
  defaultRedirectTarget: string;

  /**
   * The state to redirect the user to. Defaults to defaultRedirectTarget.
   */
  errorRedirectTarget?: string;

  /**
   * Timeout time for the decision obs. Defaults to 1000ms.
   */
  timeoutTime?: Milliseconds;
}

export interface AuthTransitionHookConfig extends AuthTransitionHookOptions {
  /**
   * Creates the decision observable for the transition that decides whether or not to redirect or continue.
   */
  makeDecisionsObs: (transition: Transition, authService: DbxAuthService, injector: UIInjector) => Observable<AuthTransitionDecision>;
}

export interface AuthTransitionStateData {
  /**
   * Optional getter/decision maker when a role needs to be
   */
  redirectTo?: AuthTransitionRedirectTargetOrGetter;
}

/**
 * This generates a TransitionHookFn that can be used with redirecting routes.
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
        if (typeof decision === 'boolean') {
          if (decision) {
            return of(true);
          } else {
            return redirectOut();
          }
        } else {
          const segueRef = asSegueRef(decision);
          return of($state.target(asSegueRefString(segueRef.ref), segueRef.refParams as RawParams, segueRef.refOptions as TransitionOptions));
        }
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
