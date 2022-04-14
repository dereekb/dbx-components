import { TransitionHookFn, Transition, HookResult, StateService, UIInjector, TransitionOptions, RawParams } from '@uirouter/core';
import { catchError, map, first, firstValueFrom, Observable, of } from 'rxjs';
import { SegueRef } from './../../../../router/segue';
import { DbxAuthService } from '../../../service/auth.service';

/**
 * authTransitionHookFn() configuration. The values are handled as:
 * - true: continue to the state.
 * - false: redirect to the login page.
 * - StateOrName: redirect to the target page instead.
 */
export type AuthTransitionDecision = true | false | SegueRef;

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

    function redirectOut() {
      return $state.target(defaultRedirectTarget);
    }

    const resultObs = decisionObs.pipe(
      first(),
      map((decision: AuthTransitionDecision): HookResult => {

        if (typeof decision === 'boolean') {
          if (decision) {
            return true;
          } else {
            return redirectOut();
          }
        } else {
          return $state.target(decision.ref, decision.refParams as RawParams, decision.refOptions as TransitionOptions);
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
