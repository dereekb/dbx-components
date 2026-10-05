import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type WorkInstance, type WorkUsingContext } from '@dereekb/rxjs';
import { filterMaybeArrayValues, type Maybe, type Seconds } from '@dereekb/util';
import { ALL_NOTIFICATION_DELIVERY_METHODS, type NotificationDeliveryMethod, type NotificationDeliveryMethodMap, type NotificationHealthCheckIssueCode, NotificationHealthCheckIssueAutofixType, NotificationHealthCheckStatus } from '@dereekb/firebase';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionHandlerDirective, DbxActionValueDirective } from '@dereekb/dbx-core';
import { DbxActionErrorDirective, DbxButtonComponent, DbxContentPitDirective, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationUserHealthCheckStore, type DbxFirebaseNotificationUserHealthCheckRunParams } from '../store/notificationuser.healthcheck.store';
import { type DbxFirebaseNotificationHealthCheckAutofixActionMap, type DbxFirebaseNotificationHealthCheckProbeActionMap, DbxFirebaseNotificationHealthCheckComponent } from '../component/healthcheck.component';
import { type DbxFirebaseNotificationHealthCheckIssueAutofixActionConfig } from '../component/healthcheck.issue.component';
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
 * Input for composing a delivery method's test message notice.
 */
interface DbxFirebaseNotificationHealthCheckProbeNoticeInput {
  /**
   * What the method's test message is called mid-sentence, e.g. `test email`.
   */
  readonly noun: string;
  /**
   * How long is left in this method's test message window.
   */
  readonly secondsRemaining: Seconds;
  /**
   * Whether this view dispatched this method's test message just now.
   */
  readonly justSent: boolean;
  /**
   * Whether this method's test message is still awaiting an outcome.
   */
  readonly pending: boolean;
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
 *
 * A dispatched test message settles later, on the delivery provider's schedule. This view watches for
 * that outcome itself rather than telling the user to come back and re-run the check: the store polls a
 * cheap server-side verification while anything is in flight, and the report — read live from the
 * document — updates the moment the result lands.
 *
 * An admin view sets `showIssueDetails` to see the detail behind each finding, and `allowAutofix` to offer
 * a fix for each finding its provider marked as fixable. Both default to off, since the fix endpoint is
 * admin-only and the detail is diagnostic.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck-view',
  template: `
    @if (existsSignal()) {
      @if (healthCheckSignal(); as healthCheck) {
        <dbx-firebase-notification-healthcheck [healthCheck]="healthCheck" [probeActions]="probeActionsSignal()" [showIssueDetails]="showIssueDetails()" [autofixActions]="autofixActionsSignal()"></dbx-firebase-notification-healthcheck>
      } @else {
        <dbx-content-pit class="dbx-mb3">
          <p class="dbx-hint no-margin">Your notification delivery has not been checked yet. Run a check to find out why you may not be receiving notifications.</p>
        </dbx-content-pit>
      }

      <div class="dbx-flex-bar">
        <!-- the action takes no input, so the bare dbxActionValue marks it value-ready on trigger -->
        <!-- dbxActionDisabled rather than the button's own disabled input, since dbxActionButton drives that from the action's state -->
        <div dbxAction dbxActionValue [dbxActionDisabled]="isThrottledSignal()" [dbxActionHandler]="handleRunHealthCheck">
          <dbx-button dbxActionButton [stroked]="true" text="Run Check" icon="refresh"></dbx-button>
          <dbx-error dbxActionError></dbx-error>
        </div>
      </div>
      <div>
        @if (throttleNoticeSignal(); as throttleNotice) {
          <div class="dbx-small dbx-hint dbx-pt2">{{ throttleNotice }}</div>
        }
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
  imports: [DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxButtonComponent, DbxContentPitDirective, DbxErrorComponent, DbxFirebaseNotificationHealthCheckComponent],
  providers: [DbxFirebaseNotificationUserHealthCheckStore]
})
export class DbxFirebaseNotificationHealthCheckViewComponent {
  private readonly _presentationService = inject(DbxFirebaseNotificationHealthCheckPresentationService);

  readonly healthCheckStore = inject(DbxFirebaseNotificationUserHealthCheckStore);

  /**
   * Whether each finding renders its structured detail, such as when and from which email an address
   * unsubscribed. For an admin reviewing someone else's delivery.
   */
  readonly showIssueDetails = input<Maybe<boolean>>();

  /**
   * Whether to offer a fix for each finding its provider marked as fixable.
   *
   * Only enable this where the viewer is an admin: the server refuses the fix for anyone else.
   */
  readonly allowAutofix = input<Maybe<boolean>>();

  readonly existsSignal = toSignal(this.healthCheckStore.exists$, { initialValue: false });
  readonly healthCheckSignal = toSignal(this.healthCheckStore.healthCheck$);
  readonly latestHealthCheckResultSignal = toSignal(this.healthCheckStore.latestHealthCheckResult$);
  readonly throttleSecondsRemainingSignal = toSignal(this.healthCheckStore.throttleSecondsRemaining$, { initialValue: 0 });
  readonly isThrottledSignal = toSignal(this.healthCheckStore.isThrottled$, { initialValue: false });
  readonly probeThrottleSecondsRemainingByMethodSignal = toSignal(this.healthCheckStore.probeThrottleSecondsRemainingByMethod$, { initialValue: {} as NotificationDeliveryMethodMap<Seconds> });

  private readonly _lastRequestedProbeMethod = signal<Maybe<NotificationDeliveryMethod>>(undefined);

  constructor() {
    // The report is streamed from the document, so an outcome the server settles shows up on its own.
    // This is what makes the server settle it without the user asking.
    this.healthCheckStore.watchPendingProbes();
  }

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
   *
   * Everything the user needs to read about a test message belongs in the section holding the button
   * that sent it, so the notice is composed here rather than in a footer: what was just sent, that its
   * outcome is being watched for, and when another may be sent.
   */
  readonly probeActionsSignal = computed<DbxFirebaseNotificationHealthCheckProbeActionMap>(() => {
    const secondsRemainingByMethod = this.probeThrottleSecondsRemainingByMethodSignal();
    const justSentMethod = this.latestHealthCheckResultSignal()?.probesDispatched ? this.lastRequestedProbeMethodSignal() : undefined;
    const probeActions: DbxFirebaseNotificationHealthCheckProbeActionMap = {};

    (this.healthCheckSignal()?.m ?? [])
      .filter((methodResult) => methodResult.pb === true)
      .forEach(({ me: method, tg: target, pr: probe }) => {
        const label = this._presentationService.testMessageLabelForDeliveryMethod(method);
        const noun = this._presentationService.testMessageNounForDeliveryMethod(method);
        const methodLabel = this._presentationService.labelForDeliveryMethod(method).toLowerCase();
        const secondsRemaining = secondsRemainingByMethod[method] ?? 0;

        probeActions[method] = {
          label,
          icon: 'send',
          disabled: secondsRemaining > 0,
          notice: this.probeNoticeForMethod({ noun, secondsRemaining, justSent: method === justSentMethod, pending: probe?.s === NotificationHealthCheckStatus.PENDING }),
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

  /**
   * Composes one delivery method's test message notice.
   *
   * Deliberately never tells the user to come back and check: a pending outcome is watched for
   * automatically, so the only thing left to say about the wait is that they need do nothing.
   *
   * @param input - What the method sends, how long its window has left, and the state of its probe.
   * @returns The notice, or undefined when there is nothing worth saying.
   */
  private probeNoticeForMethod(input: DbxFirebaseNotificationHealthCheckProbeNoticeInput): Maybe<string> {
    const { noun, secondsRemaining, justSent, pending } = input;
    let sent: Maybe<string>;

    if (justSent) {
      sent = `A ${noun} was just sent.`;
    } else if (secondsRemaining > 0) {
      sent = `A ${noun} was sent recently.`;
    }

    const waiting = pending ? ' The result will appear here on its own as soon as we hear whether it arrived.' : '';
    const nextAllowed = secondsRemaining > 0 ? ` Another can be sent in ${formatSecondsRemaining(secondsRemaining)}.` : '';

    return sent == null ? undefined : `${sent}${waiting}${nextAllowed}`;
  }

  /**
   * The fix handler for each delivery method and issue code, created on first use and then reused.
   *
   * Kept stable for the same reason as the test message handlers: `dbxActionHandler` installs its handler
   * in an effect, so a fresh closure on every recompute would re-install it for no reason.
   */
  private readonly _autofixHandlers = new Map<string, WorkUsingContext>();

  /**
   * The fix to offer for each finding the provider marked as fixable, when this view allows fixes.
   *
   * The confirmation says what the fix changes and for which address. An explicit-only fix, such as lifting
   * a spam complaint, leads with what the recipient chose and when overriding it is acceptable, and is the
   * only kind of fix sent with `allowExplicitAutofix`.
   */
  readonly autofixActionsSignal = computed<Maybe<DbxFirebaseNotificationHealthCheckAutofixActionMap>>(() => {
    const healthCheck = this.healthCheckSignal();
    const allowAutofix = this.allowAutofix() === true;
    const autofixActions: DbxFirebaseNotificationHealthCheckAutofixActionMap = {};

    (allowAutofix ? (healthCheck?.m ?? []) : []).forEach(({ me: method, tg: target, is: issues }) => {
      const methodAutofixActions: Record<NotificationHealthCheckIssueCode, DbxFirebaseNotificationHealthCheckIssueAutofixActionConfig> = {};

      issues.forEach((issue) => {
        const autofix = this._presentationService.autofixPresentationForIssue(issue);

        if (autofix != null) {
          const explicit = issue.af === NotificationHealthCheckIssueAutofixType.EXPLICIT;
          const destination = target ? `This applies to ${target}.` : undefined;
          const prompt = filterMaybeArrayValues([autofix.warning, autofix.description, destination, 'Continue?']).join(' ');

          methodAutofixActions[issue.c] = {
            label: autofix.label,
            icon: 'build',
            confirm: {
              title: autofix.label,
              prompt,
              confirmText: autofix.label
            },
            handler: this.autofixHandlerFor(method, issue.c, explicit)
          };
        }
      });

      if (Object.keys(methodAutofixActions).length > 0) {
        autofixActions[method] = methodAutofixActions;
      }
    });

    return allowAutofix ? autofixActions : undefined;
  });

  /**
   * The fix handler for one finding, reused across recomputes.
   *
   * @param method - The delivery method the finding belongs to.
   * @param code - The finding's issue code.
   * @param explicit - Whether the fix is explicit-only, and so must be sent with `allowExplicitAutofix`.
   * @returns The handler that runs the fix as the action's work.
   */
  private autofixHandlerFor(method: NotificationDeliveryMethod, code: NotificationHealthCheckIssueCode, explicit: boolean): WorkUsingContext {
    const handlerKey = `${method}:${code}:${explicit}`;
    let handler = this._autofixHandlers.get(handlerKey);

    if (handler == null) {
      handler = (_, context) => {
        this.healthCheckStore.runHealthCheckAutofix({ method, codes: [code], allowExplicitAutofix: explicit || undefined });
        context.startWorkingWithLoadingStateObservable(this.healthCheckStore.healthCheckAutofixResultState$);
      };

      this._autofixHandlers.set(handlerKey, handler);
    }

    return handler;
  }

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
