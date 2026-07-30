import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { type Maybe } from '@dereekb/util';
import { DbxColorDirective, DbxContentPitDirective, DbxIconTileComponent } from '@dereekb/dbx-web';
import { KnownNotificationHealthCheckIssueCode, NotificationDeliveryMethod, type NotificationDeliveryMethodMap, type NotificationHealthCheck } from '@dereekb/firebase';
import { DbxFirebaseNotificationHealthCheckPresentationService } from '../service/healthcheck.presentation.service';
import { type DbxFirebaseNotificationHealthCheckMethodProbeActionConfig, DbxFirebaseNotificationHealthCheckMethodComponent } from './healthcheck.method.component';

/**
 * The test message action to offer in each delivery method's section, keyed by method.
 *
 * A method with no entry gets no test message action, as does a method the check reports as not
 * probe-capable.
 */
export type DbxFirebaseNotificationHealthCheckProbeActionMap = NotificationDeliveryMethodMap<Maybe<DbxFirebaseNotificationHealthCheckMethodProbeActionConfig>>;

/**
 * Delivery methods this report never renders a section for, whatever the check says about them.
 *
 * The in-app summary channel is the app's own notification page, so the user is looking at the delivery
 * target while they read the report — there is nothing a section could tell them that the page does not
 * already show. The server has no health check service for it either, so it can currently only report
 * "Not Checked", which reads as a broken channel next to a working inbox.
 *
 * The server still checks and stores the method, so an API/callModel consumer keeps the result. Drop the
 * entry here to bring the section back if the server starts contributing findings worth acting on.
 */
const HIDDEN_NOTIFICATION_DELIVERY_METHODS: ReadonlySet<NotificationDeliveryMethod> = new Set([NotificationDeliveryMethod.NOTIFICATION_SUMMARY]);

/**
 * Renders a whole {@link NotificationHealthCheck}: the rolled-up status, then one section per delivery
 * method that this system can actually send through.
 *
 * This is the inlineable report — it takes the check as an input and injects nothing beyond the
 * presentation registry, so it can be dropped anywhere a check is already in hand (a settings page, a
 * dialog, an admin view). The per-method test message actions are an input for the same reason: the
 * report renders them, whoever owns the store supplies them.
 *
 * The view is client-facing, so it shows only what the user can act on. The check's account-wide
 * findings (`is`), any method the system has no send service for, and the methods in
 * {@link HIDDEN_NOTIFICATION_DELIVERY_METHODS} are left out here — all of them remain on the check
 * itself for an API/callModel consumer.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck',
  template: `
    @if (healthCheck(); as healthCheckValue) {
      <div class="dbx-flex-bar dbx-pb3">
        <dbx-icon-tile class="dbx-icon-spacer" [icon]="statusIconSignal()" [dbxColor]="statusColorSignal()" [dbxColorTone]="18"></dbx-icon-tile>
        <div class="dbx-flex-fill">
          <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-hint">Notification Delivery</div>
          <div class="dbx-text-title-large">{{ statusLabelSignal() }}</div>
          <div class="dbx-text-body-small dbx-hint">Last checked {{ healthCheckValue.at | date: 'medium' }}</div>
        </div>
      </div>

      @for (methodSection of methodSectionsSignal(); track methodSection.result.me) {
        <dbx-content-pit class="dbx-mb3">
          <dbx-firebase-notification-healthcheck-method [result]="methodSection.result" [probeAction]="methodSection.probeAction"></dbx-firebase-notification-healthcheck-method>
        </dbx-content-pit>
      }
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-healthcheck'
  },
  standalone: true,
  imports: [DatePipe, DbxColorDirective, DbxContentPitDirective, DbxIconTileComponent, DbxFirebaseNotificationHealthCheckMethodComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationHealthCheckComponent {
  private readonly _presentationService = inject(DbxFirebaseNotificationHealthCheckPresentationService);

  readonly healthCheck = input<Maybe<NotificationHealthCheck>>();

  /**
   * The test message action to offer in each method's section, keyed by delivery method.
   *
   * Left unset the report is read-only, which is what an admin or historical view wants.
   */
  readonly probeActions = input<Maybe<DbxFirebaseNotificationHealthCheckProbeActionMap>>();

  readonly statusColorSignal = computed(() => {
    const status = this.healthCheck()?.s;
    return status ? this._presentationService.colorForStatus(status) : 'grey';
  });

  readonly statusIconSignal = computed(() => {
    const status = this.healthCheck()?.s;
    return status ? this._presentationService.iconForStatus(status) : 'help';
  });

  readonly statusLabelSignal = computed(() => {
    const status = this.healthCheck()?.s;
    return status ? this._presentationService.labelForStatus(status) : '';
  });

  /**
   * The method results worth showing the user.
   *
   * A method the server has no send service for is not something the user can do anything about, so it
   * is dropped rather than rendered as a "Not Checked" section, as is any method this report does not
   * render at all — see {@link HIDDEN_NOTIFICATION_DELIVERY_METHODS}.
   */
  readonly methodResultsSignal = computed(() => (this.healthCheck()?.m ?? []).filter((result) => !HIDDEN_NOTIFICATION_DELIVERY_METHODS.has(result.me) && !result.is.some((issue) => issue.c === KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED)));

  /**
   * Each method section to render, paired with the test message action for its method.
   *
   * Paired up here rather than indexed in the template so the map lookup stays out of the view.
   */
  readonly methodSectionsSignal = computed(() => {
    const probeActions = this.probeActions();
    return this.methodResultsSignal().map((result) => ({ result, probeAction: probeActions?.[result.me] }));
  });
}
