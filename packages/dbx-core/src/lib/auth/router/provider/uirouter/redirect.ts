import { first, Observable, of, switchMap } from 'rxjs';
import { getValueFromGetter, isGetter, Maybe, ObjectMap } from "@dereekb/util";
import { AuthTransitionDecisionGetterInput, AuthTransitionRedirectTarget, AuthTransitionRedirectTargetGetter, AuthTransitionRedirectTargetOrGetter } from "./hook";
import { SegueRef } from '../../../../router/segue';
import { AuthUserState } from '../../../auth.user';

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
        let result: Maybe<Observable<Maybe<SegueRef>>>;

        if (getter) {
          if (isGetter<AuthTransitionRedirectTarget>(getter)) {
            result = getValueFromGetter(getter, input);
          } else {
            result = of(getter as Maybe<SegueRef>);
          }
        }

        if (!result) {
          result = of(undefined);
        }

        return result as Observable<Maybe<SegueRef>>;
      })
    );
  };
}
