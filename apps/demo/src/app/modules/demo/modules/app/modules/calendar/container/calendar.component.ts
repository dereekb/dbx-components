import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { DbxCalendarComponent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { DbxFirebaseStorageFileDownloadButtonComponent, type DbxFirebaseStorageFileDownloadButtonConfig, type DbxFirebaseStorageFileDownloadButtonSource, DbxFirebaseStorageFileDownloadService } from '@dereekb/dbx-firebase';
import { type ContentDispositionString, randomNumber } from '@dereekb/util';
import { type CalendarEventOccurrence, CalendarSyncState, expandCalendarEvents } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { TimeDistancePipe } from '@dereekb/dbx-core';
import { CalendarDocumentStore, ProfileDocumentStore } from 'demo-components';
import { type CalendarEvent } from 'angular-calendar';
import { addDays, setHours, startOfDay } from 'date-fns';
import { combineLatest, map, shareReplay } from 'rxjs';
import { DemoCalendarSubscribePopupComponent } from './calendar.subscribe.popup.component';
import { DemoCalendarTestEventPopupComponent } from './calendar.test.event.popup.component';

/**
 * Content disposition requested for the ICS download.
 *
 * An "attachment" disposition is what makes the browser SAVE the file. Without it the signed url serves
 * `text/calendar` inline, which browsers hand straight off to the OS calendar app instead.
 */
const DEMO_CALENDAR_ICS_CONTENT_DISPOSITION: ContentDispositionString = 'attachment; filename="calendar.ics"';

/**
 * The user's profile calendar, rendered from the Calendar model itself rather than from the ".ics" it
 * publishes — so the page always shows the current state of the model.
 */
@Component({
  templateUrl: './calendar.component.html',
  providers: [DbxCalendarStore],
  imports: [DbxCalendarComponent, DbxActionModule, DbxButtonModule, DbxFirebaseStorageFileDownloadButtonComponent, TimeDistancePipe],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoCalendarViewComponent {
  readonly matDialog = inject(MatDialog);
  readonly dbxFirebaseStorageFileDownloadService = inject(DbxFirebaseStorageFileDownloadService);
  readonly profileDocumentStore = inject(ProfileDocumentStore);
  readonly calendarDocumentStore = inject(CalendarDocumentStore);
  readonly dbxCalendarStore = inject(DbxCalendarStore<CalendarEventOccurrence>);

  /**
   * The calendar's occurrences within the window currently on screen.
   *
   * Uses the same `expandCalendarEvents()` the ICS publisher uses, so what is rendered here and what the
   * published feed contains cannot disagree. `currentData$` rather than `data$` so the page renders empty
   * instead of stalling before the first event creates `cal/pr_<uid>`.
   */
  readonly calendarEvents$ = combineLatest([this.calendarDocumentStore.currentData$, this.dbxCalendarStore.visibleDateRange$]).pipe(
    map(([calendar, { start, end }]) => (calendar ? expandCalendarEvents({ calendar, range: { start, end } }) : [])),
    map((occurrences) =>
      occurrences.map((x): CalendarEvent<CalendarEventOccurrence> => {
        return {
          id: x.key,
          title: x.item.n,
          start: x.startsAt,
          end: x.endsAt,
          allDay: x.allDay,
          meta: x
        };
      })
    ),
    shareReplay(1)
  );

  readonly visibleDateRangeSignal = toSignal(this.dbxCalendarStore.visibleDateRange$);
  readonly existsSignal = toSignal(this.calendarDocumentStore.exists$, { initialValue: false });

  readonly syncedAtSignal = toSignal(this.calendarDocumentStore.syncedAt$);
  readonly syncStateSignal = toSignal(this.calendarDocumentStore.syncState$);

  /**
   * True only while the published ICS matches the calendar's current content.
   *
   * `syncedAt` alone cannot answer this: it is the last successful upload, so it keeps reading "Sync'd 6
   * hours ago" the instant a new event makes that upload stale.
   */
  readonly isSyncedSignal = computed(() => this.syncStateSignal() === CalendarSyncState.SYNCED);

  readonly icsDownloadButtonConfig: DbxFirebaseStorageFileDownloadButtonConfig = {
    text: 'Download .ics',
    downloadReadyText: 'Download .ics',
    icon: 'event_note',
    downloadReadyIcon: 'event_note',
    // an ICS is only ever useful as a file handed to a calendar app, so there is nothing worth previewing
    showPreviewButton: false
  };

  readonly icsDownloadSource: DbxFirebaseStorageFileDownloadButtonSource = {
    storageFileKey: this.calendarDocumentStore.icsStorageFileKey$,
    // resolve the signed url up front so the button lands ready-to-save and the click is a single step
    // rather than the default "fetch url, then save" pair
    preload: true,
    handleGetDownloadUrl: (key, context) => {
      context.startWorkingWithPromise(this.dbxFirebaseStorageFileDownloadService.createDownloadPairForStorageFile(key, { responseDisposition: DEMO_CALENDAR_ICS_CONTENT_DISPOSITION }));
    }
  };

  constructor() {
    this.dbxCalendarStore.setEvents(this.calendarEvents$);
  }

  readonly handleCreateTestEvent: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.createTestCalendarEvent({ startsAt: this.randomStartsAtInView() }));
  };

  /**
   * Opens the subscribe dialog, which is where the PUBLIC feed url lives.
   *
   * A separate dialog rather than a bare copy button because the url needs framing: it is a permanent
   * zero-auth credential, the per-client subscribe steps differ, and Google's 8-24h refresh has to be stated
   * or the lag reads as a bug.
   */
  readonly openSubscribePopup = () => {
    DemoCalendarSubscribePopupComponent.openPopup(this.matDialog, {
      calendarDocumentStore: this.calendarDocumentStore,
      profileDocumentStore: this.profileDocumentStore
    });
  };

  readonly openCreateRecurringEventPopup = () => {
    DemoCalendarTestEventPopupComponent.openPopup(this.matDialog, {
      profileDocumentStore: this.profileDocumentStore,
      defaultStartsAt: this.randomStartsAtInView()
    });
  };

  /**
   * Picks a random whole hour inside the window currently on screen, so a created event lands where the
   * user is looking rather than always on today.
   *
   * @returns The instant to anchor a newly created test event at.
   */
  private randomStartsAtInView(): Date {
    const range = this.visibleDateRangeSignal();
    const start = range?.start ?? new Date();
    const end = range?.end ?? addDays(start, 1);
    const day = new Date(randomNumber({ min: start.getTime(), max: end.getTime(), round: 'floor' }));

    // a whole hour inside the working day reads better on the month view than a random millisecond
    return setHours(startOfDay(day), randomNumber({ min: 8, max: 18, round: 'floor' }));
  }
}
