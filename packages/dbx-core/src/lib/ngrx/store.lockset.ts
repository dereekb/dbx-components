import { Observable } from 'rxjs';
import { ComponentStore } from '@ngrx/component-store';
import { Inject, Optional, Injectable, OnDestroy } from '@angular/core';
import { LockSet } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

export interface LockSetComponent {
  readonly lockSet: LockSet;
}

export interface LockSetComponentStoreConfig {
  parent?: Maybe<Observable<LockSetComponent>>;
  locks?: {
    [key: string]: Observable<boolean>
  };
}

/**
 * Abstract ComponentStore extension that provides a LockSet and OnDestroy delaying/cleanup.
 */
@Injectable()
export abstract class LockSetComponentStore<S extends object> extends ComponentStore<S> implements OnDestroy {

  readonly lockSet = new LockSet();

  protected lockSetDestroyDelayMs = 2000;
  protected lockSetDestroyTimeoutMs: Maybe<number>;

  protected constructor(@Inject(null) @Optional() protected readonly initialState?: S) {
    super(initialState);
  }

  // MARK: State Changes
  readonly resetStore = this.updater(() => ({ ...this.initialState } as S));

  // MARK: Locks
  protected setupLockSet({ parent, locks }: LockSetComponentStoreConfig): void {
    if (parent) {
      this.addParentLockSet(parent);
    }

    if (locks) {
      for (const key in locks) {
        if (locks[key]) {
          this.addLock(key, locks[key]);
        }
      }
    }
  }

  protected addParentLockSet(obs: Observable<LockSetComponent>): void {
    obs.subscribe((x) => x.lockSet.addChildLockSet(this.lockSet));
  }

  protected addLock(key: string, obs: Observable<boolean>): void {
    this.lockSet.addLock(key, obs);
  }

  // MARK: Cleanup
  override ngOnDestroy(): void {

    // Wait for any actions to complete before destroying.
    this.lockSet.destroyOnNextUnlock({
      fn: () => {
        this._ngFinishDestroy();
      },
      timeout: this.lockSetDestroyTimeoutMs,
    }, this.lockSetDestroyDelayMs);
  }

  protected _ngFinishDestroy() {
    this.ngOnDestroy();
    this.lockSet.destroy();
  }

}
