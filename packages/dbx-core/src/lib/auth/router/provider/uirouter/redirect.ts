import { first, Observable, of, switchMap } from 'rxjs';
import { getValueFromGetter, isGetter, Maybe, ObjectMap } from "@dereekb/util";
import { AuthTransitionDecisionGetterInput, AuthTransitionRedirectTargetGetter, AuthTransitionRedirectTargetOrGetter } from "./hook";
import { SegueRef, AuthUserState } from '@dereekb/dbx-core';

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
        let result: Observable<Maybe<SegueRef>>;

        if (getter) {
          if (isGetter(getter)) {
            result = getValueFromGetter(getter, input);
          } else {
            result = of(getter as Maybe<SegueRef>);
          }
        }

        if (!result!) {
          result = of(undefined);
        }

        return result;
      })
    );
  };
}
