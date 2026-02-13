import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, defaultIfEmpty, map, shareReplay, switchMap } from 'rxjs';
import { DbxHelpContextKey, DbxHelpContextReference } from './help';
import { distinctUntilHasDifferentValues } from '@dereekb/rxjs';

/**
 * Service that tracks all active help context strings in the current context.
 */
@Injectable()
export class DbxHelpContextService implements OnDestroy {
  private readonly _contextReferences = new BehaviorSubject<Set<DbxHelpContextReference>>(new Set());

  /**
   * Observable of all currently active help context strings.
   */
  readonly activeHelpContextKeys$: Observable<Set<DbxHelpContextKey>> = this._contextReferences.pipe(
    switchMap((allReferences) =>
      combineLatest(Array.from(allReferences).map((ref) => ref.helpContextKeys$)).pipe(
        map((x) => x.flat()),
        defaultIfEmpty([]),
        map((x) => new Set(x))
      )
    ),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly activeHelpContextKeysArray$ = this.activeHelpContextKeys$.pipe(
    map((x) => Array.from(x)),
    shareReplay(1)
  );

  register(reference: DbxHelpContextReference): void {
    const referenceSet = this._contextReferences.value;
    referenceSet.add(reference);
    this._contextReferences.next(referenceSet);
  }

  unregister(reference: DbxHelpContextReference): void {
    const referenceSet = this._contextReferences.value;
    referenceSet.delete(reference);
    this._contextReferences.next(referenceSet);
  }

  ngOnDestroy(): void {
    this._contextReferences.complete();
  }
}
