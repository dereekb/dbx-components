import { Injectable, OnDestroy, Provider } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Subject, distinct, map } from 'rxjs';
import { SegueRef } from '@dereekb/dbx-core';
import { isMaybeNot, Maybe } from '@dereekb/util';

export interface TwoColumnsState {
  /**
   * Whether or not to reverse the sizing.
   */
  reverseSizing: boolean;
  /**
   * Whether or not the right side should be shown.
   */
  showRight: boolean;
  /**
   * Whether or not there is any registered right content currently.
   */
  hasRight: boolean;
  /**
   * Whether or not to allow the left to fill up the screen when no right is shown.
   */
  fullLeft: boolean;
  /**
   * Optional ref to use with TwoColumns that use an sref for the back button.
   */
  backRef?: Maybe<SegueRef>;
  /**
   * Size of the view's total width in pixels.
   */
  totalWidth?: Maybe<number>;
  /**
   * Minimum right side size allowed before hiding the left content.
   */
  minRightWidth: number;
}

export const DEFAULT_TWO_COLUMNS_MIN_RIGHT_WIDTH = 320;

const INITIAL_STATE: TwoColumnsState = {
  reverseSizing: false,
  showRight: false,
  hasRight: false,
  fullLeft: false,
  minRightWidth: DEFAULT_TWO_COLUMNS_MIN_RIGHT_WIDTH
};

@Injectable()
export class TwoColumnsContextStore extends ComponentStore<TwoColumnsState> implements OnDestroy {
  private readonly _back = new Subject<void>();

  constructor() {
    super({ ...INITIAL_STATE });
  }

  // MARK: Accessors
  readonly hideLeft$ = this.state$.pipe(
    map((x) => {
      /**
       * The right side is less-than or equal to half the total width when resizing, so we can use the total width to guess the best case current scenario.
       */
      const expectedRightWidth = (x.totalWidth ?? 0) / 2;
      const hideLeft = x.showRight && expectedRightWidth < x.minRightWidth;
      return hideLeft;
    })
  );

  /**
   * Pipes the current state of reverseSizing.
   */
  readonly reverseSizing$ = this.state$.pipe(map((x) => x.reverseSizing));

  /**
   * Pipes the current state of showRight.
   */
  readonly hasRight$ = this.state$.pipe(map((x) => x.showRight));

  /**
   * Pipes the current state of showRight.
   */
  readonly currentShowRight$ = this.state$.pipe(map((x) => x.showRight));

  /**
   * Pipes the current state of showRight and hasRight
   */
  readonly showRight$ = this.state$.pipe(map((x) => x.hasRight && x.showRight));

  /**
   * Convenience function for the showRight compliment.
   */
  readonly hideRight$ = this.showRight$.pipe(map((x) => !x));

  /**
   * Pipes the current state of fullLeft.
   */
  readonly fullLeft$ = this.state$.pipe(map((x) => x.fullLeft));

  /**
   * Whether or not to show the full left.
   */
  readonly showFullLeft$ = this.state$.pipe(map((x) => !(x.hasRight && x.showRight) && x.fullLeft));

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
  readonly setReverseSizing = this.updater((state, reverseSizing: Maybe<boolean>) => (isMaybeNot(reverseSizing) ? state : { ...state, reverseSizing }));

  /**
   * Changes the state to have right content or not.
   */
  readonly setHasRight = this.updater((state, hasRight: Maybe<boolean>) => (isMaybeNot(hasRight) ? state : { ...state, hasRight }));

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
  readonly setBackRef = this.updater((state, backRef: Maybe<SegueRef>) => ({ ...state, backRef }));

  /**
   * Sets the new total width.
   */
  readonly setTotalWidth = this.updater((state, totalWidth: Maybe<number>) => ({ ...state, totalWidth }));

  /**
   * Sets the new min right width.
   */
  readonly setMinRightWidth = this.updater((state, minRightWidth: Maybe<number>) => ({ ...state, minRightWidth: minRightWidth ?? DEFAULT_TWO_COLUMNS_MIN_RIGHT_WIDTH }));

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
