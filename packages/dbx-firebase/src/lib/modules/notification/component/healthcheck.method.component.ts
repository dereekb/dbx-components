import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { type Maybe } from '@dereekb/util';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { type DbxActionConfirmConfig, DbxActionConfirmDirective, DbxActionErrorDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent } from '@dereekb/dbx-web';
import { type NotificationDeliveryHealthCheckResult } from '@dereekb/firebase';
import { DbxFirebaseNotificationHealthCheckPresentationService } from '../service/healthcheck.presentation.service';
import { DbxFirebaseNotificationHealthCheckIssueComponent } from './healthcheck.issue.component';

/**
 * The "send a test message" action for one delivery method's section.
 *
 * Carries the handler rather than the section emitting an output: the button — and so the `dbxAction`
 * host that drives it — lives inside the section, while the behaviour belongs to whoever owns the store.
 * The section stays presentational and the container stays in charge of what the action does.
 */
export interface DbxFirebaseNotificationHealthCheckMethodProbeActionConfig {
  /**
   * Label for the button, e.g. `Send Test Email`.
   */
  readonly label: string;
  /**
   * Material icon name for the button.
   */
  readonly icon?: Maybe<string>;
  /**
   * Whether the action is currently unavailable — typically because the server's probe window for this
   * method has not passed yet.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * Explains why the action is unavailable, shown above the button.
   */
  readonly notice?: Maybe<string>;
  /**
   * Confirmation shown before the action runs.
   *
   * Effectively required, for two reasons: a test message is delivered to the user for real, and
   * confirming is also what marks the action value-ready. Without a confirm the button triggers but the
   * handler never runs.
   */
  readonly confirm?: Maybe<DbxActionConfirmConfig>;
  /**
   * Dispatches the test message.
   */
  readonly handler: WorkUsingContext;
}

/**
 * Renders one delivery method's health check result: where it would deliver to, everything the check
 * found for it, the state of any test message that was sent through it, and — when the method can be
 * probed and an action is supplied — the button for sending a new one.
 *
 * Presentational: it injects nothing beyond the presentation registry, so it can be dropped anywhere a
 * result is already in hand. The test message action is an input rather than something it resolves.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck-method',
  template: `
    @if (result(); as resultValue) {
      <div class="dbx-flex-bar dbx-pb1">
        <dbx-icon-tile class="dbx-icon-spacer" [icon]="methodIconSignal()" [dbxColor]="statusColorSignal()" [dbxColorTone]="18"></dbx-icon-tile>
        <div class="dbx-flex-fill">
          <div class="dbx-text-title-medium">{{ methodLabelSignal() }}</div>
          @if (resultValue.tg) {
            <div class="dbx-text-body-small dbx-hint">{{ resultValue.tg }}</div>
          } @else {
            <div class="dbx-text-body-small dbx-hint">No destination</div>
          }
        </div>
        <dbx-chip [small]="true" [color]="statusColorSignal()">{{ statusLabelSignal() }}</dbx-chip>
      </div>

      @for (issue of resultValue.is; track $index) {
        <div class="dbx-pt2">
          <dbx-firebase-notification-healthcheck-issue [issue]="issue" [method]="resultValue.me"></dbx-firebase-notification-healthcheck-issue>
        </div>
      }

      @if (resultValue.pr; as probe) {
        <div class="dbx-pt2 dbx-text-body-small dbx-hint">
          {{ testMessageSentLabelSignal() }} {{ probe.at | date: 'medium' }}
          @if (probe.d) {
            · {{ probe.d }}
          }
        </div>
      }

      @if (probeActionSignal(); as probeAction) {
        <div class="dbx-pt2">
          <!-- dbxActionDisabled rather than the button's own disabled input, since dbxActionButton drives that from the action's state -->
          <div dbxAction [dbxActionDisabled]="probeAction.disabled === true" [dbxActionHandler]="probeAction.handler" [dbxActionConfirm]="probeAction.confirm">
            <dbx-button dbxActionButton [stroked]="true" [text]="probeAction.label" [icon]="probeAction.icon"></dbx-button>
            <dbx-error dbxActionError></dbx-error>
          </div>
        </div>
        @if (probeAction.notice) {
          <div class="dbx-small dbx-hint dbx-pt2">{{ probeAction.notice }}</div>
        }
      }
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-healthcheck-method'
  },
  standalone: true,
  imports: [DatePipe, DbxActionButtonDirective, DbxActionConfirmDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent, DbxFirebaseNotificationHealthCheckIssueComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationHealthCheckMethodComponent {
  private readonly _presentationService = inject(DbxFirebaseNotificationHealthCheckPresentationService);

  readonly result = input<Maybe<NotificationDeliveryHealthCheckResult>>();

  /**
   * The test message action to offer for this method, when the owner of the check has one to offer.
   *
   * Ignored unless the result reports that the method can actually be probed.
   */
  readonly probeAction = input<Maybe<DbxFirebaseNotificationHealthCheckMethodProbeActionConfig>>();

  readonly methodLabelSignal = computed(() => {
    const method = this.result()?.me;
    return method ? this._presentationService.labelForDeliveryMethod(method) : '';
  });

  readonly methodIconSignal = computed(() => {
    const method = this.result()?.me;
    return method ? this._presentationService.iconForDeliveryMethod(method) : 'notifications';
  });

  readonly statusColorSignal = computed(() => {
    const status = this.result()?.s;
    return status ? this._presentationService.colorForStatus(status) : 'grey';
  });

  readonly statusLabelSignal = computed(() => {
    const status = this.result()?.s;
    return status ? this._presentationService.labelForStatus(status) : '';
  });

  /**
   * Introduces the dispatched probe's timestamp, naming what was actually sent.
   *
   * Sentence-cased from the method's mid-sentence noun, since it opens the line.
   */
  readonly testMessageSentLabelSignal = computed(() => {
    const method = this.result()?.me;
    const noun = method ? this._presentationService.testMessageNounForDeliveryMethod(method) : 'test message';
    return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} sent`;
  });

  /**
   * The action to render, which requires the server to have reported this method as probe-capable.
   *
   * The result is the authority on that, so an action supplied for a method that cannot be probed is
   * dropped rather than offering the user a test message the server would refuse to send.
   */
  readonly probeActionSignal = computed(() => {
    const probeSupported = this.result()?.pb === true;
    const probeAction = this.probeAction();
    return probeSupported ? probeAction : undefined;
  });
}
