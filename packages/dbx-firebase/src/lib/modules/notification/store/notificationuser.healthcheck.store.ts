import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS,
  NotificationDeliveryMethod,
  type NotificationDeliveryMethodMap,
  notificationHealthCheckPendingProbeMethods,
  notificationUserHealthCheckNextProbeAtByMethod,
  notificationUserHealthCheckNextRunAt,
  notificationUserHealthCheckNextVerifyAt,
  type NotificationUserHealthCheckAutofixParams,
  type NotificationUserHealthCheckAutofixResult,
  type NotificationUserHealthCheckParams,
  type NotificationUserHealthCheckResult
} from '@dereekb/firebase';
import { errorResult, type LoadingState, startWithBeginLoading } from '@dereekb/rxjs';
import { areEqualPOJOValues, filterMaybeArrayValues, type Maybe, MS_IN_SECOND, type Seconds } from '@dereekb/util';
import { addMinutes, isAfter } from 'date-fns';
import { catchError, combineLatest, distinctUntilChanged, EMPTY, exhaustMap, filter, map, type Observable, of, shareReplay, switchMap, takeWhile, tap, timer, withLatestFrom } from 'rxjs';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { type DbxFirebaseDocumentStoreFunctionParamsInput } from '../../../model/modules/store';
import { DbxFirebaseNotificationHealthCheckConfig, DEFAULT_NOTIFICATION_HEALTH_CHECK_PROBE_WATCH_MINUTES } from '../service/healthcheck.presentation';
import { NotificationUserDocumentStore } from './notificationuser.document.store';

/**
 * Params for a health check run. The store injects the NotificationUser key, so it is not required.
 */
export type DbxFirebaseNotificationUserHealthCheckRunParams = DbxFirebaseDocumentStoreFunctionParamsInput<NotificationUserHealthCheckParams>;

/**
 * Params for a health check autofix. The store injects the NotificationUser key, so it is not required.
 */
export type DbxFirebaseNotificationUserHealthCheckAutofixParams = DbxFirebaseDocumentStoreFunctionParamsInput<NotificationUserHealthCheckAutofixParams>;

/**
 * Treats an autofix that left any issue unfixed as a failure.
 *
 * The server reports a fix the provider could not apply as an unfixed result rather than an error, so
 * the other fixes in the same call still go through. A caller watching the action needs to see it fail,
 * with the provider's reason, so the loading state is turned into an error carrying those reasons.
 *
 * @param state - The loading state of an autofix call.
 * @returns The same state, or an error state when a fix was not applied.
 */
function healthCheckAutofixUnfixedResultsAsError(state: LoadingState<NotificationUserHealthCheckAutofixResult>): LoadingState<NotificationUserHealthCheckAutofixResult> {
  const unfixed = state.value?.results.filter((x) => !x.fixed) ?? [];
  const message = unfixed.map((x) => x.message ?? `${x.code} could not be fixed.`).join(' ');
  return unfixed.length > 0 ? errorResult<NotificationUserHealthCheckAutofixResult>({ code: 'NOTIFICATION_HEALTH_CHECK_AUTOFIX_NOT_APPLIED', message }) : state;
}

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
  /**
   * The loading state of the most recent autofix made through this store.
   *
   * Only set once a fix has been dispatched. A fix that left any issue unfixed is an error state carrying
   * the provider's reasons.
   */
  readonly healthCheckAutofixResultState?: Maybe<LoadingState<NotificationUserHealthCheckAutofixResult>>;
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

  private readonly _authService = inject(DbxFirebaseAuthService);

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

  /**
   * The loading state of the most recent {@link runHealthCheckAutofix} dispatch.
   *
   * Like {@link healthCheckResultState$}, a dispatch sets this to a loading state synchronously, so a
   * caller that dispatches and then watches it is watching its own fix.
   */
  readonly healthCheckAutofixResultState$ = this.select((state) => state.healthCheckAutofixResultState).pipe(distinctUntilChanged(), shareReplay(1));

  // MARK: Destinations
  /**
   * Where each method delivers to now, read live from the document, so it follows a contact change made after the stored check
   * was run. A test message is sent to this destination, since the server resolves it again on every run.
   *
   * Resolved like the server: the override on the global config (`gc.e` / `gc.t`), otherwise the email on the user's auth
   * record, which is only known here when the NotificationUser is the signed-in user's own. Texts only go to `gc.t`. A method whose destination cannot
   * be known here is absent, and a method known to have no destination is null. Only email and text are resolved, since only
   * they deliver to a contact the user can change.
   */
  readonly currentDeliveryTargetByMethod$: Observable<NotificationDeliveryMethodMap<Maybe<string>>> = combineLatest([this.notificationUserDocumentStore.data$, this._authService.currentAuthUser$]).pipe(
    map(([notificationUser, authUser]) => {
      const { gc, uid } = notificationUser;
      const isOwnNotificationUser = authUser != null && authUser.uid === uid;
      const targets: NotificationDeliveryMethodMap<Maybe<string>> = {};

      if (gc.e != null || isOwnNotificationUser) {
        targets[NotificationDeliveryMethod.EMAIL] = gc.e ?? authUser?.email ?? null;
      }

      // texts never fall back to the auth phone number
      if (gc.t != null || isOwnNotificationUser) {
        targets[NotificationDeliveryMethod.TEXT] = gc.t ?? null;
      }

      return targets;
    }),
    distinctUntilChanged(areEqualPOJOValues),
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

  // MARK: Pending Probes
  /**
   * The delivery methods whose test message is still waiting on an outcome.
   *
   * The one part of a stored check that changes without anyone re-running it, so it is what
   * {@link watchPendingProbes} watches.
   */
  readonly pendingProbeMethods$: Observable<NotificationDeliveryMethod[]> = this.healthCheck$.pipe(
    map((healthCheck) => notificationHealthCheckPendingProbeMethods(healthCheck)),
    distinctUntilChanged(areEqualPOJOValues),
    shareReplay(1)
  );

  /**
   * Whether a test message is in flight right now.
   */
  readonly hasPendingProbe$: Observable<boolean> = this.pendingProbeMethods$.pipe(
    map((x) => x.length > 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The next verification to run, or null when there is nothing to watch.
   *
   * Re-derived from the document on every change, which is what paces the loop: each verification
   * advances the stored check's `vat`, so the moment the server will accept another poll moves forward
   * and this emits the next one. The watch gives up once the oldest probe has been in flight longer than
   * the configured window — a provider that is never going to record an outcome should not be polled for
   * as long as the page stays open.
   */
  private readonly _nextProbeVerification$: Observable<Maybe<DbxFirebaseNotificationUserHealthCheckProbeVerification>> = this.healthCheck$.pipe(
    map((healthCheck) => {
      const methods = notificationHealthCheckPendingProbeMethods(healthCheck);
      const dispatchedAt = filterMaybeArrayValues((healthCheck?.m ?? []).filter((x) => methods.includes(x.me)).map((x) => x.pr?.at));
      const watchMinutes = this._config?.probeWatchMinutes ?? DEFAULT_NOTIFICATION_HEALTH_CHECK_PROBE_WATCH_MINUTES;
      const oldestDispatchedAt = dispatchedAt.length ? new Date(Math.min(...dispatchedAt.map((x) => x.getTime()))) : undefined;
      const at = notificationUserHealthCheckNextVerifyAt({ healthCheck, throttleSeconds: this._config?.verifyThrottleSeconds }) ?? new Date();
      const stillWorthWatching = oldestDispatchedAt != null && isAfter(addMinutes(oldestDispatchedAt, watchMinutes), at);

      return stillWorthWatching ? { methods, at } : undefined;
    }),
    distinctUntilChanged(areEqualPOJOValues),
    shareReplay(1)
  );

  // MARK: State Changes
  private readonly _setHealthCheckResultState = this.updater((state, healthCheckResultState: Maybe<LoadingState<NotificationUserHealthCheckResult>>) => ({ ...state, healthCheckResultState }));
  private readonly _setHealthCheckAutofixResultState = this.updater((state, healthCheckAutofixResultState: Maybe<LoadingState<NotificationUserHealthCheckAutofixResult>>) => ({ ...state, healthCheckAutofixResultState }));

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

  /**
   * Fixes issues the stored health check marked as fixable, and puts the outcome on
   * {@link healthCheckAutofixResultState$}.
   *
   * Admin only on the server. The fix also checks the delivery method again, and the stored check is
   * streamed into {@link healthCheck$}, so a fixed issue simply disappears from the report.
   *
   * While a fix is in flight further dispatches are ignored, so the state always reflects the fix that is
   * actually happening.
   */
  readonly runHealthCheckAutofix = this.effect((input: Observable<DbxFirebaseNotificationUserHealthCheckAutofixParams>) =>
    input.pipe(
      exhaustMap((params) =>
        this.notificationUserDocumentStore.healthCheckAutofix(params).pipe(
          startWithBeginLoading(),
          map(healthCheckAutofixUnfixedResultsAsError),
          catchError((error) => of(errorResult<NotificationUserHealthCheckAutofixResult>(error))),
          tap((healthCheckAutofixResultState) => this._setHealthCheckAutofixResultState(healthCheckAutofixResultState))
        )
      )
    )
  );

  /**
   * Watches every in-flight test message until it has an outcome, without the user doing anything.
   *
   * A dispatched probe settles on the delivery provider's schedule rather than the caller's, so
   * something has to ask again once the outcome exists. That used to be the user, told to come back and
   * re-run the check; this is that same poll, run automatically. Each verification is scoped to the
   * methods actually awaiting an outcome and answers to its own server-side window, so it neither sends
   * anything nor consumes the user's allowance for running the check itself. The result lands on the
   * NotificationUser, which is already streamed into {@link healthCheck$}, so a settled probe simply
   * appears in the report.
   *
   * Idempotent to start and safe to leave running: it does nothing at all while no probe is in flight,
   * and stops on its own once every probe has settled or aged out.
   */
  readonly watchPendingProbes = this.effect<void>((input) =>
    input.pipe(
      switchMap(() =>
        this._nextProbeVerification$.pipe(
          // The interval is the recovery path: a verification that advances `vat` re-emits the value
          // above and restarts this timer, while one that fails to reach the server leaves the value
          // unchanged and is simply retried on the next tick.
          switchMap((verification) => (verification == null ? EMPTY : timer(Math.max(0, verification.at.getTime() - Date.now()), (this._config?.verifyThrottleSeconds ?? DEFAULT_NOTIFICATION_USER_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS) * MS_IN_SECOND).pipe(map(() => verification.methods)))),
          withLatestFrom(this.healthCheckResultState$, this.healthCheckAutofixResultState$),
          // A verification carries the whole stored check forward, so one racing a run the user started
          // could write back a copy taken before that run's result landed. The user's run always wins, as
          // does an autofix, which ends in a run of its own.
          filter(([, healthCheckResultState, healthCheckAutofixResultState]) => healthCheckResultState?.loading !== true && healthCheckAutofixResultState?.loading !== true),
          exhaustMap(([methods]) =>
            this.notificationUserDocumentStore.healthCheck({ verifyPendingProbesOnly: true, methods }).pipe(
              catchError(() => EMPTY) // nothing to report: the poll is invisible, and the next tick retries
            )
          )
        )
      )
    )
  );
}

/**
 * A scheduled verification of the test messages a check has in flight.
 */
export interface DbxFirebaseNotificationUserHealthCheckProbeVerification {
  /**
   * The delivery methods awaiting an outcome.
   */
  readonly methods: NotificationDeliveryMethod[];
  /**
   * The earliest time the server will accept the verification.
   */
  readonly at: Date;
}
