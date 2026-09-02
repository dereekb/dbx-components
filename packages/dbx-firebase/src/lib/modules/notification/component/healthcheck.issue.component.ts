import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxChipDirective, DbxColorDirective, DbxIconTileComponent } from '@dereekb/dbx-web';
import { type NotificationDeliveryMethod, type NotificationHealthCheckIssue } from '@dereekb/firebase';
import { DbxFirebaseNotificationHealthCheckPresentationService } from '../service/healthcheck.presentation.service';

/**
 * Renders a single {@link NotificationHealthCheckIssue}: its status chip, what was found, and what to
 * do about it.
 *
 * The chip's label and icon come from the {@link DbxFirebaseNotificationHealthCheckPresentationService}
 * registry; the message and the suggested fix always come from the issue itself, so an issue code the
 * registry has never seen still renders correctly.
 *
 * The finding's structured detail (`d`) is deliberately not rendered — values like the sending domain
 * or the delivery method key are diagnostic rather than user-facing. They remain on the issue itself,
 * so an API/callModel consumer still receives them.
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
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-healthcheck-issue'
  },
  imports: [DbxChipDirective, DbxColorDirective, DbxIconTileComponent]
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

  readonly presentationSignal = computed(() => {
    const issue = this.issue();
    const method = this.method();
    return issue ? this._presentationService.presentationForIssue(issue, method) : { label: '', icon: '', color: 'grey' as const };
  });
}
