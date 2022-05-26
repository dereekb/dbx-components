import { Injectable, OnDestroy, Provider } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Subject, distinct, map } from 'rxjs';
import { SegueRef } from '@dereekb/dbx-core';
import { isMaybeNot, Maybe } from '@dereekb/util';

export interface TwoColumnsState {
  showRight: boolean;
  /**
   * Whether or not to allow the left to fill up the screen when no right is shown.
   */
  fullLeft: boolean;
  /**
   * Optional ref to use with TwoColumns that use an sref for the back button.
   */
  backRef?: SegueRef;
}

const INITIAL_STATE: TwoColumnsState = {
  showRight: false,
  fullLeft: false
};

@Injectable()
export class TwoColumnsContextStore extends ComponentStore<TwoColumnsState> implements OnDestroy {
  private readonly _back = new Subject<void>();

  constructor() {
    super({ ...INITIAL_STATE });
  }

  // MARK: Accessors
  /**
   * Pipes the current state of showRight.
   */
  readonly showRight$ = this.state$.pipe(map((x) => x.showRight));

  /**
   * Convenience function for the showRight compliment.
   */
  readonly hideRight$ = this.state$.pipe(map((x) => !x.showRight));

  /**
   * Pipes the current state of fullLeft.
   */
  readonly fullLeft$ = this.state$.pipe(map((x) => x.fullLeft));

  /**
   * Whether or not to show the full left.
   */
  readonly showFullLeft$ = this.state$.pipe(map((x) => !x.showRight && x.fullLeft));

  /**
   * Pipes the current backRef value.
   */
  readonly backRef$ = this.state$.pipe(
    map((x) => x.backRef),
    distinct()
  );

  /**
   * Emits back events.
   */
  readonly back$ = this._back.asObservable();

  // MARK: State Changes
  /**
   * Completely resets the store.
   */
  readonly reset = this.updater(() => ({ ...INITIAL_STATE }));

  /**
   * Changes the state to show right or not.
   */
  readonly setShowRight = this.updater((state, showRight: Maybe<boolean>) => (isMaybeNot(showRight) ? state : { ...state, showRight }));

  /**
   * Sets the full left. If undefined is passed, no change occurs.
   */
  readonly setFullLeft = this.updater((state, fullLeft: Maybe<boolean>) => (isMaybeNot(fullLeft) ? state : { ...state, fullLeft }));

  /**
   * Sets the new back ref.
   */
  readonly setBackRef = this.updater((state, backRef: SegueRef) => ({ ...state, backRef }));

  /**
   * Emits a back event.
   */
  back(): void {
    this._back.next();
  }

  // MARK: Internal
  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._back.complete();
  }
}

export function provideTwoColumnsContext(): Provider[] {
  return [
    {
      provide: TwoColumnsContextStore,
      useClass: TwoColumnsContextStore
    }
  ];
}
