import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective, type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig, type DbxActionConfirmConfig, DbxActionModule, DbxAnchorComponent, DbxButtonModule, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDetailBlockComponent, DbxDialogModule, DbxErrorComponent, DbxStepBlockComponent } from '@dereekb/dbx-web';
import { clickableUrlInNewTab, type ClickableAnchor } from '@dereekb/dbx-core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type CalendarDocumentStore } from '../store/calendar.document.store';

/**
 * Google's "Other calendars -> From URL" subscription endpoint, which prefills its dialog with `cid`.
 */
const GOOGLE_CALENDAR_SUBSCRIBE_URL = 'https://calendar.google.com/calendar/r?cid=';

export interface DbxFirebaseCalendarSubscribePopupComponentConfig {
  readonly calendarDocumentStore: CalendarDocumentStore;
}

/**
 * Dialog that hands the user the calendar's PUBLIC feed url, and lets them revoke it.
 *
 * The url is a permanent, zero-auth bearer credential: anyone holding it reads the calendar, and a subscriber
 * like Google stores it inside their own account. That is what makes it work in every calendar client without
 * OAuth, and it is also why "Rotate Link" is here rather than buried in an admin tool — rotation is the ONLY
 * revocation a feed url has.
 *
 * The refresh-cadence hint is not decoration. Google re-reads a subscribed feed every 8-24 hours and honours
 * no header that asks it to hurry, so an unexplained lag between adding an event and seeing it get filed as a
 * bug. Say it up front instead.
 *
 * Rotation is offered only once the calendar document exists: the callable authorizes against the Calendar
 * itself, so a key that names nothing is rejected rather than reported as a no-op revocation.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <p class="dbx-note">Subscribe a calendar app to this calendar and it will keep itself up to date. The link below is public — anyone who has it can read this calendar.</p>
      <dbx-content-pit class="dbx-block dbx-mb3">
        <dbx-detail-block icon="link" header="Calendar feed URL">
          @if (icsUrlSignal(); as icsUrl) {
            <dbx-click-to-copy-text [copyText]="icsUrl" [clipboardSnackbarMessagesConfig]="clipboardSnackbarMessagesConfig">
              <div class="dbx-label" style="word-break: break-all;">{{ icsUrl }}</div>
            </dbx-click-to-copy-text>
          } @else {
            <div class="dbx-hint">{{ notPublishedHintSignal() }}</div>
          }
        </dbx-detail-block>
      </dbx-content-pit>
      @if (googleSubscribeAnchorSignal(); as googleSubscribeAnchor) {
        <div class="dbx-mb3">
          <dbx-anchor [anchor]="googleSubscribeAnchor">
            <dbx-button [raised]="true" color="primary" icon="open_in_new" text="Add to Google Calendar"></dbx-button>
          </dbx-anchor>
        </div>
      }
      <dbx-step-block [step]="1" header="Google Calendar">
        <p class="dbx-hint">Other calendars &rarr; From URL &rarr; paste the link. Do not use Import — an imported file never syncs again.</p>
      </dbx-step-block>
      <dbx-step-block [step]="2" header="Apple Calendar">
        <p class="dbx-hint">File &rarr; New Calendar Subscription &rarr; paste the link. The refresh interval is yours to set, down to about five minutes.</p>
      </dbx-step-block>
      <dbx-step-block [step]="3" header="Outlook">
        <p class="dbx-hint">Add calendar &rarr; Subscribe from web &rarr; paste the link.</p>
      </dbx-step-block>
      <p class="dbx-hint">Google re-checks a subscribed feed every 8&ndash;24 hours and offers no way to ask it to check sooner, so a new event can take that long to appear there. Apple and Outlook refresh considerably faster.</p>
      @if (syncStateSignal()) {
        <div class="dbx-mt3" dbxAction dbxActionValue dbxActionSnackbarError [dbxActionHandler]="handleRotateLink" [dbxActionConfirm]="rotateConfirmConfig">
          <dbx-button dbxActionButton icon="autorenew" text="Rotate Link"></dbx-button>
          <dbx-error dbxActionError></dbx-error>
        </div>
      } @else {
        <p class="dbx-hint dbx-mt3">This calendar does not exist yet, so there is no link to revoke.</p>
      }
      <dbx-dialog-content-footer (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogModule, DbxActionModule, DbxButtonModule, DbxErrorComponent, DbxAnchorComponent, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDetailBlockComponent, DbxStepBlockComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseCalendarSubscribePopupComponent extends AbstractDialogDirective<unknown, DbxFirebaseCalendarSubscribePopupComponentConfig> {
  readonly icsUrlSignal = toSignal(this.data.calendarDocumentStore.icsUrl$);
  readonly syncedAtSignal = toSignal(this.data.calendarDocumentStore.syncedAt$);

  /**
   * Whether the calendar document exists, which is the precondition for rotating its link.
   *
   * `syncState$` is undefined until the document exists, so it doubles as the existence check without a
   * second subscription.
   */
  readonly syncStateSignal = toSignal(this.data.calendarDocumentStore.syncState$);

  /**
   * Why there is no url yet, distinguishing a first publish from the gap a rotation leaves behind.
   *
   * `iu` is written only by the ICS processor's success path, so it is absent both before the first publish
   * and for as long as it takes a rotation's replacement to upload. `sat` is what tells them apart.
   */
  readonly notPublishedHintSignal = computed(() => (this.syncedAtSignal() ? 'The link is being regenerated. It will appear here once the next calendar sync publishes the replacement.' : 'This calendar has not been published yet. The link appears once the hourly calendar sync generates its ICS.'));

  readonly googleSubscribeAnchorSignal = computed((): Maybe<ClickableAnchor> => {
    const icsUrl = this.icsUrlSignal();
    return icsUrl ? clickableUrlInNewTab(`${GOOGLE_CALENDAR_SUBSCRIBE_URL}${encodeURIComponent(icsUrl)}`) : undefined;
  });

  readonly clipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the calendar feed link.'
  };

  readonly rotateConfirmConfig: DbxActionConfirmConfig = {
    title: 'Rotate the calendar link?',
    prompt: 'The current link stops working and every calendar already subscribed to it breaks. A new link is generated by the next sync.',
    confirmText: 'Rotate Link'
  };

  static openPopup(matDialog: MatDialog, config: DbxFirebaseCalendarSubscribePopupComponentConfig) {
    return matDialog.open(DbxFirebaseCalendarSubscribePopupComponent, {
      data: config
    });
  }

  readonly handleRotateLink: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.data.calendarDocumentStore.rotateIcs({}));
  };
}
