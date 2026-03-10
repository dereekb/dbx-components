import { map, type Observable } from 'rxjs';
import { ComponentStore } from '@ngrx/component-store';
import { Inject, Optional, Injectable, type OnDestroy } from '@angular/core';
import { LockSet, type ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Component or service that exposes a {@link LockSet} for coordinating lock-based state.
 */
export interface LockSetComponent {
  readonly lockSet: LockSet;
}

/**
 * Configuration for initializing a {@link LockSetComponentStore}'s lock set,
 * including an optional parent lock set and named lock observables.
 */
export interface LockSetComponentStoreConfig {
  readonly parent?: Maybe<Observable<LockSetComponent>>;
  readonly locks?: {
    [key: string]: Observable<boolean>;
  };
}

/**
 * Abstract NgRx `ComponentStore` extension that integrates a {@link LockSet} for coordinating
 * async operations and delays destruction until all locks are released.
 *
 * Subclasses call {@link setupLockSet} to register parent lock sets and named locks.
 * On destroy, the store waits for all locks to unlock before completing cleanup,
 * preventing premature teardown of in-flight operations.
 *
 * @typeParam S - The shape of the component store's state object.
 *
 * @example
 * ```typescript
 * interface MyState { items: string[]; }
 *
 * @Injectable()
 * export class MyStore extends LockSetComponentStore<MyState> {
 *   constructor() {
 *     super({ items: [] });
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class LockSetComponentStore<S extends object> extends ComponentStore<S> implements OnDestroy {
  readonly lockSet = new LockSet();

  protected lockSetDestroyDelayMs = 2000;
  protected lockSetDestroyTimeoutMs: Maybe<number>;

  // NOTE: Injection does not occur here, but we need @Injectable to compile properly for Angular usage
  // eslint-disable-next-line @angular-eslint/prefer-inject
  protected constructor(@Inject(null) @Optional() protected readonly initialState?: S) {
    super(initialState);
  }

  // MARK: State Changes
  readonly resetStore = this.updater(() => ({ ...this.initialState }) as S);

  // MARK: Locks
  protected setupLockSet({ parent, locks }: LockSetComponentStoreConfig): void {
    if (parent) {
      this.setParentLockSet(parent);
    }

    if (locks) {
      for (const key in locks) {
        if (locks[key]) {
          this.addLock(key, locks[key]);
        }
      }
    }
  }

  setParentLockSet(obs: ObservableOrValue<Maybe<LockSetComponent>>): void {
    this.lockSet.setParentLockSet(asObservable(obs).pipe(map((x) => x?.lockSet)));
  }

  addLock(key: string, obs: Observable<boolean>): void {
    this.lockSet.addLock(key, obs);
  }

  // MARK: Cleanup
  override ngOnDestroy(): void {
    // Wait for any actions to complete before destroying.
    this.lockSet.destroyOnNextUnlock(
      {
        fn: () => {
          this._destroyNow();
        },
        timeout: this.lockSetDestroyTimeoutMs
      },
      this.lockSetDestroyDelayMs
    );
  }

  /**
   * Immediately completes cleanup by destroying the lock set.
   * Called after all locks are released during the deferred destruction process.
   */
  _destroyNow() {
    this.lockSet.destroy();
  }
}
