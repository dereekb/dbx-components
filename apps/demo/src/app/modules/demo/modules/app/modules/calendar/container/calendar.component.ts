import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { DbxCalendarComponent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { type CalendarEventOccurrence, expandCalendarEvents } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { randomNumber } from '@dereekb/util';
import { CalendarDocumentStore, ProfileDocumentStore } from 'demo-components';
import { type CalendarEvent } from 'angular-calendar';
import { addDays, setHours, startOfDay } from 'date-fns';
import { combineLatest, map, shareReplay } from 'rxjs';
import { DemoCalendarTestEventPopupComponent } from './calendar.test.event.popup.component';

/**
 * The user's profile calendar, rendered from the Calendar model itself rather than from the ".ics" it
 * publishes — so the page always shows the current state of the model.
 */
@Component({
  templateUrl: './calendar.component.html',
  providers: [DbxCalendarStore],
  imports: [DbxCalendarComponent, DbxActionModule, DbxButtonModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoCalendarViewComponent {
  readonly matDialog = inject(MatDialog);
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

  constructor() {
    this.dbxCalendarStore.setEvents(this.calendarEvents$);
  }

  readonly handleCreateTestEvent: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileDocumentStore.createTestCalendarEvent({ startsAt: this.randomStartsAtInView() }));
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
