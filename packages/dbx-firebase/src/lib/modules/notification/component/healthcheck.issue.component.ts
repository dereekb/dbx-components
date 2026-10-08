import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { type Maybe } from '@dereekb/util';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { type DbxActionConfirmConfig, DbxActionConfirmDirective, DbxActionErrorDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent } from '@dereekb/dbx-web';
import { type NotificationDeliveryMethod, type NotificationHealthCheckIssue } from '@dereekb/firebase';
import { DbxFirebaseNotificationHealthCheckPresentationService } from '../service/healthcheck.presentation.service';

/**
 * The "fix this automatically" action for one finding.
 *
 * Carries the handler rather than the finding emitting an output, for the same reason as the test message
 * action: the button lives inside the finding, while the behaviour belongs to whoever owns the store.
 */
export interface DbxFirebaseNotificationHealthCheckIssueAutofixActionConfig {
  /**
   * Label for the button, e.g. `Resubscribe`.
   */
  readonly label: string;
  /**
   * Material icon name for the button.
   */
  readonly icon?: Maybe<string>;
  /**
   * Whether the action is currently unavailable.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * Confirmation shown before the fix runs, saying what it will change.
   *
   * Effectively required: a fix changes state at the delivery provider, and confirming is also what marks
   * the action value-ready. Without a confirm the button triggers but the handler never runs.
   */
  readonly confirm?: Maybe<DbxActionConfirmConfig>;
  /**
   * Applies the fix.
   */
  readonly handler: WorkUsingContext;
}

/**
 * One detail row, split by kind so the template formats dates without type checks.
 */
interface DbxFirebaseNotificationHealthCheckIssueDetailRow {
  readonly label: string;
  readonly text?: Maybe<string>;
  readonly date?: Maybe<Date>;
}

/**
 * Renders a single {@link NotificationHealthCheckIssue}: its status chip, what was found, and what to
 * do about it.
 *
 * The chip's label and icon come from the {@link DbxFirebaseNotificationHealthCheckPresentationService}
 * registry; the message and the suggested fix always come from the issue itself, so an issue code the
 * registry has never seen still renders correctly.
 *
 * The finding's structured detail (`d`) is hidden by default, because values like the sending domain or
 * the delivery method key are diagnostic rather than user-facing. An admin view sets `showDetails` to
 * render the values the registry picks out of it, such as when and from which email an address
 * unsubscribed. The detail stays on the issue either way, so an API/callModel consumer still receives it.
 *
 * An `autofixAction`, when supplied, renders after the details, so an admin reads why the issue happened
 * before fixing it.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck-issue',
  template: `
    @if (issue(); as issueValue) {
      <div class="dbx-flex-bar dbx-pb1">
        <dbx-icon-tile class="dbx-icon-spacer" [icon]="presentationSignal().icon" [dbxColor]="presentationSignal().color" [dbxColorTone]="18"></dbx-icon-tile>
        <dbx-chip [small]="true" [color]="presentationSignal().color">{{ presentationSignal().label }}</dbx-chip>
      </div>
      <p class="no-margin">{{ issueValue.m }}</p>
      @if (issueValue.f) {
        <p class="dbx-hint no-margin dbx-pt1">{{ issueValue.f }}</p>
      }
      @if (detailRowsSignal().length) {
        <div class="dbx-firebase-notification-healthcheck-issue-details dbx-pt1">
          @for (detail of detailRowsSignal(); track detail.label) {
            <div class="dbx-text-body-small">
              <span class="dbx-hint">{{ detail.label }}:</span>
              @if (detail.date) {
                {{ detail.date | date: 'medium' }}
              } @else {
                {{ detail.text }}
              }
            </div>
          }
        </div>
      }
      @if (autofixAction(); as autofix) {
        <div class="dbx-pt2">
          <!-- dbxActionDisabled rather than the button's own disabled input, since dbxActionButton drives that from the action's state -->
          <div dbxAction [dbxActionDisabled]="autofix.disabled === true" [dbxActionHandler]="autofix.handler" [dbxActionConfirm]="autofix.confirm">
            <dbx-button dbxActionButton [stroked]="true" [text]="autofix.label" [icon]="autofix.icon"></dbx-button>
            <dbx-error dbxActionError></dbx-error>
          </div>
        </div>
      }
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-healthcheck-issue'
  },
  imports: [DatePipe, DbxActionButtonDirective, DbxActionConfirmDirective, DbxActionDirective, DbxActionDisabledDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent]
})
export class DbxFirebaseNotificationHealthCheckIssueComponent {
  private readonly _presentationService = inject(DbxFirebaseNotificationHealthCheckPresentationService);

  readonly issue = input<Maybe<NotificationHealthCheckIssue>>();

  /**
   * The delivery method this finding belongs to, when it belongs to one.
   *
   * Only used to label a probe finding with what was actually sent — `Test Email Sent` rather than the
   * method-agnostic `Test Sent` — since every provider emits the same probe codes. An account-wide
   * finding leaves it unset.
   */
  readonly method = input<Maybe<NotificationDeliveryMethod>>();

  /**
   * Whether to render the finding's structured detail, for an admin reviewing it.
   *
   * Defaults to false: a user-facing report shows only the message and the suggested fix.
   */
  readonly showDetails = input<Maybe<boolean>>();

  /**
   * The automatic fix to offer for this finding, when the owner of the check has one to offer.
   */
  readonly autofixAction = input<Maybe<DbxFirebaseNotificationHealthCheckIssueAutofixActionConfig>>();

  readonly presentationSignal = computed(() => {
    const issue = this.issue();
    const method = this.method();
    return issue ? this._presentationService.presentationForIssue(issue, method) : { label: '', icon: '', color: 'grey' as const };
  });

  readonly detailRowsSignal = computed<DbxFirebaseNotificationHealthCheckIssueDetailRow[]>(() => {
    const showDetails = this.showDetails();
    const issue = this.issue();
    const details = issue != null && showDetails === true ? this._presentationService.detailsForIssue(issue) : [];
    return details.map(({ label, value }) => (value instanceof Date ? { label, date: value } : { label, text: value }));
  });
}
