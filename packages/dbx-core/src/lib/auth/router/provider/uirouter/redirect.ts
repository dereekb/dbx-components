import { first, type Observable, of, switchMap } from 'rxjs';
import { getValueFromGetter, isGetter, type Maybe, type ObjectMap } from '@dereekb/util';
import { type AuthTransitionDecisionGetterInput, type AuthTransitionRedirectTarget, type AuthTransitionRedirectTargetGetter, type AuthTransitionRedirectTargetOrGetter } from './hook';
import { type SegueRefOrSegueRefRouterLink } from '../../../../router/segue';
import { type AuthUserState } from '../../../auth.user';

/**
 * Creates an {@link AuthTransitionRedirectTargetGetter} that dynamically determines the redirect
 * destination based on the current {@link AuthUserState}.
 *
 * This is useful when different auth states should redirect to different routes. For example,
 * a `'new'` user might be redirected to an onboarding page while an `'anon'` user is sent to login.
 *
 * Each value in the `stateMap` can be either a static route reference or a dynamic getter
 * for more complex redirect logic.
 *
 * @param stateMap - An object map where keys are {@link AuthUserState} values and values are
 *   redirect targets (static or dynamic) for that state.
 * @returns An {@link AuthTransitionRedirectTargetGetter} that resolves the redirect based on the current auth state.
 *
 * @example
 * ```ts
 * const redirectGetter = redirectBasedOnAuthUserState({
 *   'none': '/auth/login',
 *   'anon': '/auth/login',
 *   'new': '/onboard',
 *   'user': '/app'
 * });
 * ```
 *
 * @see {@link AuthTransitionRedirectTargetOrGetter}
 * @see {@link AuthUserState}
 */
export function redirectBasedOnAuthUserState(stateMap: ObjectMap<AuthTransitionRedirectTargetOrGetter>): AuthTransitionRedirectTargetGetter {
  return (input: AuthTransitionDecisionGetterInput) => {
    return input.authService.authUserState$.pipe(
      first(),
      switchMap((authUserState: AuthUserState) => {
        const getter = stateMap[authUserState];
        let result: Maybe<Observable<Maybe<SegueRefOrSegueRefRouterLink>>>;

        if (getter) {
          if (isGetter<AuthTransitionRedirectTarget>(getter)) {
            result = getValueFromGetter(getter, input);
          } else {
            result = of(getter);
          }
        }

        if (!result) {
          result = of(undefined);
        }

        return result;
      })
    );
  };
}
