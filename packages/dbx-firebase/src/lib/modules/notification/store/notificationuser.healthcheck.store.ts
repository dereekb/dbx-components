import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type NotificationDeliveryMethod, type NotificationDeliveryMethodMap, notificationUserHealthCheckNextProbeAtByMethod, notificationUserHealthCheckNextRunAt, type NotificationUserHealthCheckParams, type NotificationUserHealthCheckResult } from '@dereekb/firebase';
import { errorResult, type LoadingState, startWithBeginLoading } from '@dereekb/rxjs';
import { areEqualPOJOValues, type Maybe, type Seconds } from '@dereekb/util';
import { catchError, distinctUntilChanged, exhaustMap, map, type Observable, of, shareReplay, switchMap, takeWhile, tap, timer } from 'rxjs';
import { type DbxFirebaseDocumentStoreFunctionParamsInput } from '../../../model/modules/store';
import { DbxFirebaseNotificationHealthCheckConfig } from '../service/healthcheck.presentation';
import { NotificationUserDocumentStore } from './notificationuser.document.store';

/**
 * Params for a health check run. The store injects the NotificationUser key, so it is not required.
 */
export type DbxFirebaseNotificationUserHealthCheckRunParams = DbxFirebaseDocumentStoreFunctionParamsInput<NotificationUserHealthCheckParams>;

/**
 * Counts down the seconds until the input time, once per second.
 *
 * Emits 0 and stops ticking as soon as the time passes, so nothing keeps counting while the action it
 * gates is available. A null input means there is nothing to wait for.
 *
 * @param date$ - The time being waited for.
 * @returns The seconds remaining, counting down to 0.
 */
function secondsRemainingUntil(date$: Observable<Maybe<Date>>): Observable<Seconds> {
  return date$.pipe(
    switchMap((date) =>
      date == null
        ? of(0)
        : timer(0, 1000).pipe(
            map(() => Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000))),
            takeWhile((secondsRemaining) => secondsRemaining > 0, true)
          )
    ),
    distinctUntilChanged(),
    shareReplay(1)
  );
}

/**
 * Counts down the seconds until each delivery method's time, once per second.
 *
 * The per-method form of {@link secondsRemainingUntil}. One timer drives every method, so several open
 * countdowns tick in step rather than drifting apart, and the ticking stops once every window has
 * passed. A method with nothing to wait for is left out.
 *
 * @param datesByMethod$ - The time being waited for on each method.
 * @returns The seconds remaining per method, counting down to 0.
 */
function secondsRemainingUntilByMethod(datesByMethod$: Observable<NotificationDeliveryMethodMap<Maybe<Date>>>): Observable<NotificationDeliveryMethodMap<Seconds>> {
  return datesByMethod$.pipe(
    switchMap((datesByMethod) => {
      const pendingEntries = Object.entries(datesByMethod).filter(([, date]) => date != null) as [NotificationDeliveryMethod, Date][];

      return pendingEntries.length === 0
        ? of<NotificationDeliveryMethodMap<Seconds>>({})
        : timer(0, 1000).pipe(
            map(() => {
              const secondsRemainingByMethod: NotificationDeliveryMethodMap<Seconds> = {};

              pendingEntries.forEach(([method, date]) => {
                secondsRemainingByMethod[method] = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
              });

              return secondsRemainingByMethod;
            }),
            // emit the all-zero value, then stop: every window has passed
            takeWhile((secondsRemainingByMethod) => Object.values(secondsRemainingByMethod).some((x) => x > 0), true)
          );
    }),
    distinctUntilChanged(areEqualPOJOValues),
    shareReplay(1)
  );
}

export interface DbxFirebaseNotificationUserHealthCheckStoreState {
  /**
   * The loading state of the most recent health check run made through this store.
   *
   * Only set once a run has been dispatched. The check itself is persisted on the NotificationUser,
   * so the stored one is read from the document instead.
   */
  readonly healthCheckResultState?: Maybe<LoadingState<NotificationUserHealthCheckResult>>;
}

/**
 * Store for running a notification delivery health check against the NotificationUser of the
 * injected {@link NotificationUserDocumentStore}, and for retaining the result of that run.
 *
 * Exists separately from the document store because a run returns more than what is persisted:
 * `probesDispatched`/`probesResolved` are only available on the invocation result, and are only
 * relevant to the session that ran the check.
 */
@Injectable()
export class DbxFirebaseNotificationUserHealthCheckStore extends ComponentStore<DbxFirebaseNotificationUserHealthCheckStoreState> {
  readonly notificationUserDocumentStore = inject(NotificationUserDocumentStore);

  /**
   * The app's health check tuning, when it configured any.
   *
   * Optional: without it both windows fall back to the library defaults, which is correct for an app
   * that did not override them on the server either.
   */
  private readonly _config = inject(DbxFirebaseNotificationHealthCheckConfig, { optional: true });

  constructor() {
    super({});
  }

  // MARK: Accessors
  /**
   * Whether the NotificationUser being checked exists.
   *
   * There is nothing to check until notifications have been set up for the account.
   */
  readonly exists$ = this.notificationUserDocumentStore.currentExists$;

  /**
   * The health check stored on the document.
   *
   * The check is persisted on every run, so the most recent one renders without invoking anything.
   */
  readonly healthCheck$ = this.notificationUserDocumentStore.data$.pipe(
    map((x) => x.hc),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The loading state of the most recent {@link runHealthCheck} dispatch.
   *
   * A dispatch sets this to a loading state synchronously, so a caller that dispatches and then
   * watches this observable is watching its own run.
   */
  readonly healthCheckResultState$ = this.select((state) => state.healthCheckResultState).pipe(distinctUntilChanged(), shareReplay(1));

  /**
   * The full result of the most recent {@link runHealthCheck} run from this store.
   *
   * `probesDispatched`/`probesResolved` are not part of the document, so they are only available here
   * and only until the store is destroyed.
   */
  readonly latestHealthCheckResult$ = this.healthCheckResultState$.pipe(
    map((x) => x?.value),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: Throttle
  /**
   * The earliest time another run is allowed, derived from the check stored on the document.
   *
   * Undefined until a check has been run.
   */
  readonly nextRunAt$ = this.healthCheck$.pipe(
    map((healthCheck) => notificationUserHealthCheckNextRunAt({ healthCheck, throttleMinutes: this._config?.runThrottleMinutes })),
    distinctUntilChanged((a, b) => a?.getTime() === b?.getTime()),
    shareReplay(1)
  );

  /**
   * The earliest time another test message may be dispatched through each delivery method.
   *
   * Per method, because the server's probe window is per method: each method has its own test message
   * action, and a test email must not hold the test text message off. Tracked separately from
   * {@link nextRunAt$} as well — running the check does not consume the test message allowance, so a
   * plain run must not disable any of the probe actions.
   */
  readonly nextProbeAtByMethod$: Observable<NotificationDeliveryMethodMap<Maybe<Date>>> = this.healthCheck$.pipe(
    map((healthCheck) => notificationUserHealthCheckNextProbeAtByMethod({ healthCheck, throttleMinutes: this._config?.probeThrottleMinutes })),
    distinctUntilChanged(areEqualPOJOValues),
    shareReplay(1)
  );

  /**
   * How long until another run is allowed, counting down once per second.
   */
  readonly throttleSecondsRemaining$: Observable<Seconds> = secondsRemainingUntil(this.nextRunAt$);

  /**
   * How long until another test message may be dispatched through each delivery method, counting down
   * once per second.
   *
   * A method whose window has never opened — no probe has been dispatched through it — is absent, which
   * a consumer reads the same as 0.
   */
  readonly probeThrottleSecondsRemainingByMethod$: Observable<NotificationDeliveryMethodMap<Seconds>> = secondsRemainingUntilByMethod(this.nextProbeAtByMethod$);

  /**
   * Whether the server would reject a run right now.
   *
   * The server enforces the throttle; this is what lets the view disable the action instead of letting
   * the user trigger a call that comes back as an error.
   */
  readonly isThrottled$ = this.throttleSecondsRemaining$.pipe(
    map((secondsRemaining) => secondsRemaining > 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  private readonly _setHealthCheckResultState = this.updater((state, healthCheckResultState: Maybe<LoadingState<NotificationUserHealthCheckResult>>) => ({ ...state, healthCheckResultState }));

  // MARK: Effects
  /**
   * Runs the document store's health check for its NotificationUser and puts the outcome on
   * {@link healthCheckResultState$}.
   *
   * Dispatching a real test message is opt-in via the `sendProbe` param, since it delivers actual
   * mail/SMS to the user.
   *
   * While a run is in flight further dispatches are ignored, so the state always reflects the run
   * that is actually happening.
   */
  readonly runHealthCheck = this.effect((input: Observable<Maybe<DbxFirebaseNotificationUserHealthCheckRunParams>>) =>
    input.pipe(
      exhaustMap((params) =>
        this.notificationUserDocumentStore.healthCheck(params ?? {}).pipe(
          startWithBeginLoading(), // emit loading synchronously so a dispatcher can pick this run up off the state
          catchError((error) => of(errorResult<NotificationUserHealthCheckResult>(error))), // an error here would otherwise kill this effect's subscription
          tap((healthCheckResultState) => this._setHealthCheckResultState(healthCheckResultState))
        )
      )
    )
  );
}
