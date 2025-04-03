// === Before ===
import { inject, Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, Subject, combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';

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
  selector: 'dbxActionAutoTrigger, [dbxActionAutoTrigger]',
  standalone: true
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
  set useFastTriggerPreset(fastTrigger: Maybe<boolean> | '') {
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

// === After ===
import { inject, Directive, Input, OnInit, OnDestroy, input, computed, signal, InputSignalWithTransform } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, Subject, combineLatest, Observable, BehaviorSubject, tap } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isDefinedAndNotFalse, isNotFalse, type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

const DEFAULT_DEBOUNCE_MS = 2 * 1000;

const DEFAULT_THROTTLE_MS = 10 * 1000;

const DEFAULT_ERROR_THROTTLE_MS = 3 * 1000;

const MAX_ERRORS_TO_THROTTLE_ON = 6;

const DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE = 200;
const DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE = 10;

/**
 * Directive that automatically triggers the action periodically when it is in a modified state.
 *
 * When using auto triggers be sure to make sure that the action is not triggering too often due to misconfiguration.
 */
@Directive({
  selector: 'dbxActionAutoTrigger,[dbxActionAutoTrigger]',
  standalone: true
})
export class DbxActionAutoTriggerDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly triggerDebounce = input<Maybe<number>, number>(DEFAULT_DEBOUNCE_MS, { transform: (x) => x ?? DEFAULT_DEBOUNCE_MS });
  readonly triggerThrottle = input<Maybe<number>, number>(DEFAULT_THROTTLE_MS, { transform: (x) => x ?? DEFAULT_THROTTLE_MS });
  readonly triggerErrorThrottle = input<Maybe<number>, number>(DEFAULT_ERROR_THROTTLE_MS, { transform: (x) => x ?? DEFAULT_ERROR_THROTTLE_MS });
  readonly maxErrorsForThrottle = input<Maybe<number>, number>(MAX_ERRORS_TO_THROTTLE_ON, { transform: (x) => x ?? MAX_ERRORS_TO_THROTTLE_ON });
  readonly triggerLimit = input<Maybe<number>>();
  readonly triggerEnabled = input<boolean, string | boolean>(true, { alias: 'dbxActionAutoTrigger', transform: isNotFalse });
  readonly useFastTriggerPreset = input<boolean, string | boolean>(false, { transform: isDefinedAndNotFalse });
  readonly useInstantTriggerPreset = input<boolean, string | boolean>(false, { transform: isDefinedAndNotFalse });

  readonly triggerDebounceSignal = computed(() => {
    let debounce = this.triggerDebounce() as number;

    if (debounce === undefined) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return debounce;
  });

  readonly triggerThrottleSignal = computed(() => {
    let throttle = this.triggerThrottle() as number;

    if (throttle === undefined) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return throttle;
  });

  readonly triggerCountSignal = signal<number>(0);

  readonly _errorCount$ = this.source.errorCountSinceLastSuccess$;
  readonly _triggerCount$ = this.source.isModifiedAndCanTriggerUpdates$.pipe(
    // each time something is triggered the
    filter(() => this.triggerEnabled() ?? false),
    debounce(() => interval(this.triggerDebounceSignal())),
    throttle(
      () =>
        this._errorCount$.pipe(
          first(),
          exhaustMap((errorCount) => {
            const maxErrors = this.maxErrorsForThrottle() ?? MAX_ERRORS_TO_THROTTLE_ON;
            const throttleTime = this.triggerErrorThrottle() ?? DEFAULT_ERROR_THROTTLE_MS;
            const additionalInterval = Math.min(errorCount, maxErrors) * throttleTime;

            return interval(this.triggerThrottleSignal() + additionalInterval);
          })
        ),
      { leading: true, trailing: true }
    ),
    // Check again for the "trailing" piece.
    filter(() => this.triggerEnabled() ?? false),
    mergeMap(() => this.source.isModifiedAndCanTrigger$.pipe(first())),
    filter((x) => x),
    map(() => {
      const count = this.triggerCountSignal();
      this.triggerCountSignal.update((x) => x + 1);
      return count;
    }),
    shareReplay(1)
  );

  /**
   * Observable for the trigger mechanism.
   */
  readonly triggerCount$ = toObservable(this.triggerEnabled).pipe(
    switchMap((enabled) => {
      let countObs: Observable<number>;

      if (enabled !== false) {
        countObs = this._triggerCount$;
      } else {
        countObs = EMPTY;
      }

      return countObs;
    })
  );

  private readonly _isTriggerLimited$: Observable<readonly [number, boolean]> = combineLatest([this.triggerCount$, toObservable(this.triggerLimit)]).pipe(
    map(([triggerCount, limit]) => {
      const isAllowedToRun = limit != null ? triggerCount < limit : true;
      return [triggerCount, isAllowedToRun] as const;
    }),
    shareReplay(1)
  );

  readonly isTriggerAllowedToRun$ = this._isTriggerLimited$.pipe(map((x) => x[1]), shareReplay(1));
  readonly automaticTrigger$: Observable<void> = this._isTriggerLimited$.pipe(
    filter((x) => x[1]),
    distinctUntilChanged((a, b) => a[0] === b[0]), // Only trigger when the count changes.
    map(() => undefined as void)
  );

  ngOnInit(): void {
    this.sub = this.automaticTrigger$.subscribe(() => {
      this.source.trigger();
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
    });
  }

}
