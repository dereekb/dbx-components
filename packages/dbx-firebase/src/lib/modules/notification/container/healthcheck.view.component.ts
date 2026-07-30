import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type WorkInstance, type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe, type Seconds } from '@dereekb/util';
import { ALL_NOTIFICATION_DELIVERY_METHODS, type NotificationDeliveryMethod, type NotificationDeliveryMethodMap } from '@dereekb/firebase';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionHandlerDirective, DbxActionValueDirective } from '@dereekb/dbx-core';
import { DbxActionErrorDirective, DbxButtonComponent, DbxContentPitDirective, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationUserHealthCheckStore, type DbxFirebaseNotificationUserHealthCheckRunParams } from '../store/notificationuser.healthcheck.store';
import { type DbxFirebaseNotificationHealthCheckProbeActionMap, DbxFirebaseNotificationHealthCheckComponent } from '../component/healthcheck.component';
import { DbxFirebaseNotificationHealthCheckPresentationService } from '../service/healthcheck.presentation.service';

/**
 * Formats a throttle countdown for display.
 *
 * @param secondsRemaining - Seconds left in the window.
 * @returns A short duration, e.g. `9m 12s` or `43s`.
 */
function formatSecondsRemaining(secondsRemaining: Seconds): string {
  const minutes = Math.floor(secondsRemaining / 60);
  const minutesPrefix = minutes > 0 ? `${minutes}m ` : '';
  return `${minutesPrefix}${secondsRemaining % 60}s`;
}

/**
 * Renders the notification delivery health check for the ancestor NotificationUserDocumentStore, and
 * the actions for re-running it.
 *
 * The check is persisted on the NotificationUser, so the last one renders immediately without invoking
 * anything. "Run Check" re-runs it and stays a single global action, since a run only reads
 * configuration and provider state. Sending a test message is per delivery method instead — it
 * dispatches a real message through that one method, and answers to that method's own throttle window —
 * so its action lives in that method's section rather than in a footer.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck-view',
  template: `
    @if (existsSignal()) {
      @if (healthCheckSignal(); as healthCheck) {
        <dbx-firebase-notification-healthcheck [healthCheck]="healthCheck" [probeActions]="probeActionsSignal()"></dbx-firebase-notification-healthcheck>
      } @else {
        <dbx-content-pit class="dbx-mb3">
          <p class="dbx-hint no-margin">Your notification delivery has not been checked yet. Run a check to find out why you may not be receiving notifications.</p>
        </dbx-content-pit>
      }

      @if (probeNoticeSignal(); as probeNotice) {
        <p class="dbx-hint dbx-pb2">{{ probeNotice }}</p>
      }

      @if (throttleNoticeSignal(); as throttleNotice) {
        <p class="dbx-hint dbx-pb2">{{ throttleNotice }}</p>
      }

      <div class="dbx-flex-bar">
        <!-- the action takes no input, so the bare dbxActionValue marks it value-ready on trigger -->
        <!-- dbxActionDisabled rather than the button's own disabled input, since dbxActionButton drives that from the action's state -->
        <div dbxAction dbxActionValue [dbxActionDisabled]="isThrottledSignal()" [dbxActionHandler]="handleRunHealthCheck">
          <dbx-button dbxActionButton [stroked]="true" text="Run Check" icon="refresh"></dbx-button>
          <dbx-error dbxActionError></dbx-error>
        </div>
      </div>
    } @else {
      <dbx-content-pit>
        <p class="dbx-hint no-margin">Notification settings have not been set up for this account yet, so there is nothing to check.</p>
      </dbx-content-pit>
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-healthcheck-view'
  },
  standalone: true,
  imports: [DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxButtonComponent, DbxContentPitDirective, DbxErrorComponent, DbxFirebaseNotificationHealthCheckComponent],
  providers: [DbxFirebaseNotificationUserHealthCheckStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationHealthCheckViewComponent {
  private readonly _presentationService = inject(DbxFirebaseNotificationHealthCheckPresentationService);

  readonly healthCheckStore = inject(DbxFirebaseNotificationUserHealthCheckStore);

  readonly existsSignal = toSignal(this.healthCheckStore.exists$, { initialValue: false });
  readonly healthCheckSignal = toSignal(this.healthCheckStore.healthCheck$);
  readonly latestHealthCheckResultSignal = toSignal(this.healthCheckStore.latestHealthCheckResult$);
  readonly throttleSecondsRemainingSignal = toSignal(this.healthCheckStore.throttleSecondsRemaining$, { initialValue: 0 });
  readonly isThrottledSignal = toSignal(this.healthCheckStore.isThrottled$, { initialValue: false });
  readonly probeThrottleSecondsRemainingByMethodSignal = toSignal(this.healthCheckStore.probeThrottleSecondsRemainingByMethod$, { initialValue: {} as NotificationDeliveryMethodMap<Seconds> });

  private readonly _lastRequestedProbeMethod = signal<Maybe<NotificationDeliveryMethod>>(undefined);

  /**
   * The delivery method whose test message was most recently requested from this view.
   *
   * Recorded because the invocation result reports only how many probes it dispatched, so this is what
   * lets the notice name what was sent.
   */
  readonly lastRequestedProbeMethodSignal = this._lastRequestedProbeMethod.asReadonly();

  /**
   * The test message handler for each delivery method, built once up front.
   *
   * A per-method countdown rebuilds that method's action config every second, and `dbxActionHandler`
   * installs its handler in an effect, so handing over a fresh closure on each tick would re-install it
   * once a second for no reason.
   */
  private readonly _sendTestMessageHandlers = new Map<NotificationDeliveryMethod, WorkUsingContext>(
    ALL_NOTIFICATION_DELIVERY_METHODS.map((method) => [
      method,
      (_, context) => {
        this._lastRequestedProbeMethod.set(method);
        this.runHealthCheckAsWork(context, { sendProbe: true, methods: [method] });
      }
    ])
  );

  /**
   * Explains a probe that this session dispatched or resolved.
   *
   * The counts are only returned by the invocation, not stored on the document, so this is the one
   * place they can be reported. A dispatch names what was sent, using the method whose action was
   * triggered — the result carries a count but not which method it came from. A resolution cannot be
   * named the same way: a plain run resolves whatever was in flight across every method at once.
   */
  readonly probeNoticeSignal = computed(() => {
    const result = this.latestHealthCheckResultSignal();
    const method = this.lastRequestedProbeMethodSignal();
    let notice: string | undefined;

    if (result?.probesDispatched) {
      const noun = method ? this._presentationService.testMessageNounForDeliveryMethod(method) : 'test message';
      notice = `A ${noun} was just sent. Re-run this check in a couple of minutes to see whether it arrived.`;
    } else if (result?.probesResolved) {
      notice = result.probesResolved === 1 ? 'The test message that was in flight now has a result.' : 'The test messages that were in flight now have results.';
    }

    return notice;
  });

  /**
   * Explains why "Run Check" is disabled while the server's run throttle is in effect.
   */
  readonly throttleNoticeSignal = computed(() => {
    const secondsRemaining = this.throttleSecondsRemainingSignal();
    return secondsRemaining > 0 ? `This was checked a moment ago. Another check can be run in ${formatSecondsRemaining(secondsRemaining)}.` : undefined;
  });

  /**
   * The test message action for each delivery method the check reports as probe-capable.
   *
   * A method that cannot be probed gets no entry, so no test message is offered where the server has no
   * way to send one.
   */
  readonly probeActionsSignal = computed<DbxFirebaseNotificationHealthCheckProbeActionMap>(() => {
    const secondsRemainingByMethod = this.probeThrottleSecondsRemainingByMethodSignal();
    const probeActions: DbxFirebaseNotificationHealthCheckProbeActionMap = {};

    (this.healthCheckSignal()?.m ?? [])
      .filter((methodResult) => methodResult.pb === true)
      .forEach(({ me: method, tg: target }) => {
        const label = this._presentationService.testMessageLabelForDeliveryMethod(method);
        const noun = this._presentationService.testMessageNounForDeliveryMethod(method);
        const methodLabel = this._presentationService.labelForDeliveryMethod(method).toLowerCase();
        const secondsRemaining = secondsRemainingByMethod[method] ?? 0;

        probeActions[method] = {
          label,
          icon: 'send',
          disabled: secondsRemaining > 0,
          notice: secondsRemaining > 0 ? `A ${noun} was sent recently. Another can be sent in ${formatSecondsRemaining(secondsRemaining)}.` : undefined,
          confirm: {
            title: label,
            prompt: `This sends a real ${methodLabel} to ${target ?? 'your contact details'} so we can confirm whether it arrives. Continue?`,
            confirmText: label
          },
          handler: this._sendTestMessageHandlers.get(method) as WorkUsingContext
        };
      });

    return probeActions;
  });

  readonly handleRunHealthCheck: WorkUsingContext = (_, context) => {
    this.runHealthCheckAsWork(context, {});
  };

  /**
   * Dispatches a run to the store, then tracks that run's loading state as the action's work.
   *
   * The store's effect sets the loading state synchronously as it is dispatched, so handing the state
   * observable over afterwards tracks this run instead of completing on the previous run's result.
   *
   * @param context - The work instance of the action being handled.
   * @param params - The params for this run, such as which methods to send a test message through.
   */
  private runHealthCheckAsWork(context: WorkInstance, params: DbxFirebaseNotificationUserHealthCheckRunParams): void {
    this.healthCheckStore.runHealthCheck(params);
    context.startWorkingWithLoadingStateObservable(this.healthCheckStore.healthCheckResultState$);
  }
}
