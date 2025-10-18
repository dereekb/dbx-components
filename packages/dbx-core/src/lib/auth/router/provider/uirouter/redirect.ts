import { first, type Observable, of, switchMap } from 'rxjs';
import { getValueFromGetter, isGetter, type Maybe, type ObjectMap } from '@dereekb/util';
import { type AuthTransitionDecisionGetterInput, type AuthTransitionRedirectTarget, type AuthTransitionRedirectTargetGetter, type AuthTransitionRedirectTargetOrGetter } from './hook';
import { type SegueRefOrSegueRefRouterLink } from '../../../../router/segue';
import { type AuthUserState } from '../../../auth.user';

/**
 * Creates a AuthTransitionRedirectTargetGetter that can redirect values based on the current authUserState.
 *
 * @param stateMap
 * @returns
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
