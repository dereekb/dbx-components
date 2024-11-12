import { inject, Directive, Input, OnInit, OnDestroy, Host } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, Subject, combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isDefinedAndNotFalse, Maybe } from '@dereekb/util';

const DEFAULT_DEBOUNCE_MS = 2 * 1000;

const DEFAULT_THROTTLE_MS = 10 * 1000;

const DEFAULT_ERROR_THROTTLE_MS = 3 * 1000;

const MAX_ERRORS_TO_THROTTLE_ON = 6;

/**
 * Directive that automatically triggers the action periodically when it is in a modified state.
 *
 * When using auto triggers be sure to make sure that the action is not triggering too often due to misconfiguration.
 */
@Directive({
  selector: 'dbxActionAutoTrigger, [dbxActionAutoTrigger]'
})
export class DbxActionAutoTriggerDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _triggerEnabled = new BehaviorSubject<boolean>(true);
  private readonly _triggerLimit = new BehaviorSubject<number | undefined>(undefined);
  private readonly _trigger = new Subject<number>();

  /**
   * How much to throttle the auto-triggering.
   */
  @Input('dbxActionAutoTrigger')
  get triggerEnabled(): boolean {
    return this._triggerEnabled.value;
  }

  set triggerEnabled(triggerEnabled: Maybe<boolean> | '') {
    triggerEnabled = triggerEnabled !== false; // Default to true

    if (this.triggerEnabled !== triggerEnabled) {
      this._triggerEnabled.next(triggerEnabled);
    }
  }

  @Input()
  triggerDebounce = DEFAULT_DEBOUNCE_MS;

  @Input()
  triggerThrottle = DEFAULT_THROTTLE_MS;

  @Input()
  triggerErrorThrottle = DEFAULT_ERROR_THROTTLE_MS;

  maxErrorsForThrottle = MAX_ERRORS_TO_THROTTLE_ON;

  /**
   * Optional input to override both triggerDebounce and triggerThrottle.
   *
   * Used in forms that are simple.
   */
  @Input()
  set fastTrigger(fastTrigger: Maybe<boolean> | '') {
    if (isDefinedAndNotFalse(fastTrigger)) {
      this.triggerDebounce = 200;
      this.triggerThrottle = 500;
    }
  }

  /**
   * Optional input to override both triggerDebounce and triggerThrottle to be 0.
   *
   * Used in forms that generally return a single value.
   */
  @Input()
  set instantTrigger(instantTrigger: Maybe<boolean> | '') {
    if (isDefinedAndNotFalse(instantTrigger)) {
      this.triggerDebounce = 10;
      this.triggerThrottle = 0;
    }
  }

  @Input()
  get triggerLimit(): Maybe<number> {
    return this._triggerLimit.value;
  }

  set triggerLimit(triggerLimit: Maybe<number>) {
    triggerLimit = triggerLimit || 0;
    this._triggerLimit.next(triggerLimit);
  }

  private _triggerCount = 0;

  readonly _errorCount$ = this.source.errorCountSinceLastSuccess$;

  readonly _triggerCount$ = this.source.isModifiedAndCanTriggerUpdates$.pipe(
    filter(() => this.isEnabled),
    filter((x) => x),
    debounce(() => interval(this.triggerDebounce)),
    throttle(
      () =>
        this._errorCount$.pipe(
          first(),
          exhaustMap((count) => interval(this.triggerThrottle + Math.min(count, this.maxErrorsForThrottle) * this.triggerErrorThrottle))
        ),
      { leading: true, trailing: true }
    ),
    // Check again for the "trailing" piece.
    filter(() => this.isEnabled),
    mergeMap(() => this.source.isModifiedAndCanTrigger$.pipe(first())),
    filter((x) => x),
    map(() => (this._triggerCount += 1)),
    shareReplay(1)
  );

  /**
   * Observable for the trigger mechanism.
   */
  readonly triggerCount$ = this._triggerEnabled.pipe(
    switchMap((enabled) => {
      if (enabled) {
        return this._triggerCount$;
      } else {
        return EMPTY;
      }
    })
  );

  private readonly _isTriggerLimited$: Observable<[number, boolean]> = combineLatest([this.triggerCount$, this._triggerLimit]).pipe(
    map(([triggerCount, limit]) => [triggerCount, limit ? triggerCount > limit : false] as [number, boolean]),
    shareReplay(1)
  );

  readonly isTriggerLimited$ = this._isTriggerLimited$.pipe(map((x) => x[1]));
  readonly trigger$: Observable<void> = this._isTriggerLimited$.pipe(
    filter((x) => !x[1]),
    distinctUntilChanged((a, b) => a[0] === b[0]), // Only trigger when the count changes.
    map(() => undefined as void)
  );

  constructor() {
    super();
  }

  get isEnabled(): boolean {
    return this.triggerEnabled !== false;
  }

  ngOnInit(): void {
    this.sub = this.trigger$.subscribe(() => {
      this.source.trigger();
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._triggerEnabled.complete();
      this._trigger.complete();
      this._triggerLimit.complete();
    });
  }
}
