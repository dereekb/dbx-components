import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable, combineLatest, defaultIfEmpty, map, shareReplay, switchMap } from 'rxjs';
import { type DbxHelpContextKey, type DbxHelpContextReference } from './help';
import { distinctUntilHasDifferentValues } from '@dereekb/rxjs';
import { completeOnDestroy } from '@dereekb/dbx-core';

/**
 * Tracks all active help context keys across the component tree. Directives and components register/unregister their help context references,
 * and consumers can observe the aggregated set of active keys.
 */
@Injectable()
export class DbxHelpContextService {
  private readonly _contextReferences = completeOnDestroy(new BehaviorSubject<Set<DbxHelpContextReference>>(new Set()));

  /**
   * Observable of all currently active help context strings.
   */
  readonly activeHelpContextKeys$: Observable<Set<DbxHelpContextKey>> = this._contextReferences.pipe(
    switchMap((allReferences) =>
      combineLatest([...allReferences].map((ref) => ref.helpContextKeys$)).pipe(
        map((x) => x.flat()),
        defaultIfEmpty([]),
        map((x) => new Set(x))
      )
    ),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  /**
   * Observable array of all currently active help context key strings.
   */
  readonly activeHelpContextKeysArray$ = this.activeHelpContextKeys$.pipe(
    map((x) => [...x]),
    shareReplay(1)
  );

  /**
   * Registers a help context reference, adding its keys to the active set.
   *
   * @param reference - The help context reference to register
   */
  register(reference: DbxHelpContextReference): void {
    const referenceSet = this._contextReferences.value;
    referenceSet.add(reference);
    this._contextReferences.next(referenceSet);
  }

  /**
   * Unregisters a help context reference, removing its keys from the active set.
   *
   * @param reference - The help context reference to unregister
   */
  unregister(reference: DbxHelpContextReference): void {
    const referenceSet = this._contextReferences.value;
    referenceSet.delete(reference);
    this._contextReferences.next(referenceSet);
  }
}
