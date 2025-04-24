import { Component, inject, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent } from 'angular-calendar';
import { DbxCalendarStore } from './calendar.store';
import { distinctUntilChanged, map, shareReplay, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { DbxCalendarEvent, prepareAndSortCalendarEvents } from './calendar';
import { DbxCalendarBaseComponent } from './calendar.base.component';
import { NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { CalendarModule, CalendarDayModule, CalendarWeekModule } from 'angular-calendar';

@Component({
  selector: 'dbx-calendar',
  templateUrl: './calendar.component.html',
  imports: [DbxCalendarBaseComponent, CalendarModule, CalendarDayModule, CalendarWeekModule, MatButtonToggleModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxCalendarComponent<T> {
  readonly calendarStore = inject(DbxCalendarStore<T>);

  readonly clickEvent = output<DbxCalendarEvent<T>>();

  readonly viewDate$ = this.calendarStore.date$;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));

  readonly activeDayIsOpen$ = this.calendarStore.eventsForDateState$.pipe(
    withLatestFrom(this.calendarStore.date$),
    map(([x, date]) => {
      if (x.events.length && isSameMonth(x.date, date)) {
        return !x.dateTappedTwice;
      }

      return false;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly displayType$ = this.calendarStore.displayType$;

  readonly viewDateSignal = toSignal(this.viewDate$, { initialValue: new Date() });
  readonly eventsSignal = toSignal(this.events$, { initialValue: [] });
  readonly activeDayIsOpenSignal = toSignal(this.activeDayIsOpen$, { initialValue: true });
  readonly displayTypeSignal = toSignal(this.displayType$);
  readonly displayTypeClassSignal = computed(() => `dbx-calendar-content-${this.displayTypeSignal()}`);

  todayClicked(): void {
    this.dayClicked({ date: new Date() });
  }

  nextButtonClicked(): void {
    this.calendarStore.tapNext();
  }

  previousButtonClicked(): void {
    this.calendarStore.tapPrevious();
  }

  dayClicked({ date }: { date: Date }): void {
    this.calendarStore.tapDay(date);
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
