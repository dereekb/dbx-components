import { isNot, onTrueToFalse } from '@dereekb/rxjs';
import { map, Observable, scan } from 'rxjs';

/**
 * Convenience operator that emits events when the input observable goes from true to false.
 * 
 * @param isLoggedInObs 
 * @returns 
 */
export function signedOutEventFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(onTrueToFalse(), map(_ => undefined));
}
