import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective, type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDetailBlockComponent, DbxDialogModule } from '@dereekb/dbx-web';
import { type CalendarDocumentStore } from '../store/calendar.document.store';
import { DbxFirebaseCalendarIcsRotateComponent } from './calendar.ics.rotate.component';

export interface DbxFirebaseCalendarSubscribeDialogComponentConfig {
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
 * Deliberately NOT a tutorial. Per-client subscribe steps ("Other calendars -> From URL", "New Calendar
 * Subscription", ...) go stale the moment a vendor moves a menu, and they are the one thing every calendar
 * app already documents better than we can. The dialog's job is to hand over the url and the means to revoke
 * it; what the user pastes it into is theirs.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <p class="dbx-note">Paste this link into any calendar app that supports calendar subscriptions and it will keep itself up to date. The link is public — anyone who has it can read this calendar.</p>
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
      <dbx-firebase-calendar-ics-rotate class="dbx-block dbx-mt3" [calendarDocumentStore]="data.calendarDocumentStore"></dbx-firebase-calendar-ics-rotate>
      <dbx-dialog-content-footer (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogModule, DbxClickToCopyTextComponent, DbxContentPitDirective, DbxDetailBlockComponent, DbxFirebaseCalendarIcsRotateComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseCalendarSubscribeDialogComponent extends AbstractDialogDirective<unknown, DbxFirebaseCalendarSubscribeDialogComponentConfig> {
  readonly icsUrlSignal = toSignal(this.data.calendarDocumentStore.icsUrl$);
  readonly syncedAtSignal = toSignal(this.data.calendarDocumentStore.syncedAt$);

  /**
   * Why there is no url yet, distinguishing a first publish from the gap a rotation leaves behind.
   *
   * `iu` is written only by the ICS processor's success path. A rotation expedites that publish, so this is
   * normally a first-publish message; it still covers the rotation case for as long as an expedite that did
   * not land leaves the replacement queued. `sat` is what tells the two apart.
   */
  readonly notPublishedHintSignal = computed(() => (this.syncedAtSignal() ? 'The link is being regenerated. It will appear here once the next calendar sync publishes the replacement.' : 'This calendar has not been published yet. The link appears once the hourly calendar sync generates its ICS.'));

  readonly clipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the calendar feed link.'
  };

  static openDialog(matDialog: MatDialog, config: DbxFirebaseCalendarSubscribeDialogComponentConfig): MatDialogRef<DbxFirebaseCalendarSubscribeDialogComponent> {
    return matDialog.open(DbxFirebaseCalendarSubscribeDialogComponent, {
      data: config
    });
  }
}
