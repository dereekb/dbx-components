import { TransitionHookFn, Transition, HookResult, StateService, UIInjector, TransitionOptions, RawParams } from '@uirouter/core';
import { catchError, map, first, firstValueFrom, Observable, of, switchMap } from 'rxjs';
import { SegueRef } from './../../../../router/segue';
import { DbxAuthService } from '../../../service/auth.service';
import { FactoryWithInput, FactoryWithRequiredInput, getValueFromGetter, isGetter, Maybe } from '@dereekb/util';
import { Injector } from '@angular/core';

/**
 * authTransitionHookFn() configuration. The values are handled as:
 * - true: continue to the state.
 * - false: redirect to the login page.
 * - StateOrName: redirect to the target page instead.
 */
export type AuthTransitionDecision = true | false | SegueRef;

export interface AuthTransitionDecisionGetterInput {
  readonly transition: Transition;
  readonly injector: Injector;
  readonly authService: DbxAuthService;
}

export type AuthTransitionRedirectTarget = Observable<Maybe<SegueRef>>;
export type AuthTransitionRedirectTargetGetter = FactoryWithRequiredInput<AuthTransitionRedirectTarget, AuthTransitionDecisionGetterInput>;
export type AuthTransitionRedirectTargetOrGetter = Maybe<SegueRef> | AuthTransitionRedirectTargetGetter;

export interface AuthTransitionHookOptions {

  /**
   * The state to redirect the user to when their auth fails.
   */
  defaultRedirectTarget: string;

  /**
   * The state to redirect the user to. Defaults to defaultRedirectTarget.
   */
  errorRedirectTarget?: string;

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
  const { defaultRedirectTarget, errorRedirectTarget = defaultRedirectTarget } = config;

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
        let resultObs: Observable<Maybe<SegueRef>>;

        if (isGetter<AuthTransitionRedirectTarget>(redirectTo)) {
          resultObs = getValueFromGetter(redirectTo, { authService, injector, transition } as AuthTransitionDecisionGetterInput);
        } else {
          resultObs = of(redirectTo as SegueRef);
        }

        redirectToObs = resultObs.pipe(
          map((stateRef: Maybe<SegueRef>) => {
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
      first(),
      switchMap((decision: AuthTransitionDecision): Observable<HookResult> => {
        if (typeof decision === 'boolean') {
          if (decision) {
            return of(true);
          } else {
            return redirectOut();
          }
        } else {
          return of($state.target(decision.ref, decision.refParams as RawParams, decision.refOptions as TransitionOptions));
        }
      }),
      catchError((x) => {
        console.warn('Encountered error in auth transition hook.', x);
        return of($state.target(errorRedirectTarget, { location: true })); // Redirect to home
      })
    );

    return firstValueFrom(resultObs) as HookResult;
  };

  return assertIsAuthenticated;
}
