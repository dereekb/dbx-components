import { inject, Directive, OnInit, OnDestroy, input, computed, signal, Signal } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../rxjs';
import { debounce, distinctUntilChanged, exhaustMap, filter, first, map, mergeMap, shareReplay, switchMap, throttle, EMPTY, interval, combineLatest, Observable } from 'rxjs';
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

  readonly triggerDebounce = input<Maybe<number>>(undefined);
  readonly triggerThrottle = input<Maybe<number>>(undefined);
  readonly triggerErrorThrottle = input<number, Maybe<number>>(DEFAULT_ERROR_THROTTLE_MS, { transform: (x) => x ?? DEFAULT_ERROR_THROTTLE_MS });
  readonly maxErrorsForThrottle = input<number, Maybe<number>>(MAX_ERRORS_TO_THROTTLE_ON, { transform: (x) => x ?? MAX_ERRORS_TO_THROTTLE_ON });
  readonly triggerLimit = input<Maybe<number>>();
  readonly triggerEnabled = input<boolean, Maybe<string | boolean>>(true, { alias: 'dbxActionAutoTrigger', transform: isNotFalse });
  readonly useFastTriggerPreset = input<boolean, Maybe<'' | boolean>>(false, { transform: isDefinedAndNotFalse });
  readonly useInstantTriggerPreset = input<boolean, Maybe<'' | boolean>>(false, { transform: isDefinedAndNotFalse });

  readonly triggerDebounceSignal = computed(() => {
    let debounce = this.triggerDebounce();

    if (debounce == null) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        debounce = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return debounce ?? DEFAULT_DEBOUNCE_MS;
  });

  readonly triggerThrottleSignal: Signal<number> = computed(() => {
    let throttle = this.triggerThrottle();

    if (throttle == null) {
      const useFastTrigger = this.useFastTriggerPreset();
      const useInstantTrigger = this.useInstantTriggerPreset();

      if (useFastTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_FAST_TRIGGER_DEBOUNCE;
      } else if (useInstantTrigger) {
        throttle = DBX_ACTION_AUTO_TRIGGER_INSTANT_TRIGGER_DEBOUNCE;
      }
    }

    return throttle ?? DEFAULT_THROTTLE_MS;
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

  readonly isTriggerAllowedToRun$ = this._isTriggerLimited$.pipe(
    map((x) => x[1]),
    shareReplay(1)
  );
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
