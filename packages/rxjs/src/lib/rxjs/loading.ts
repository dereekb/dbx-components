import { Observable, startWith, distinctUntilChanged, shareReplay, map } from "rxjs";

/**
 * Observable that returns true initially, then returns false as soon as a value is recieved.
 */
 export function isLoadingFromObservable(obs: Observable<any>): Observable<boolean> {
  return obs.pipe(map(_ => false), startWith(true), distinctUntilChanged(), shareReplay(1));
}
