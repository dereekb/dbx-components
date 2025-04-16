import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { DbxCalendarStore } from './calendar.store';
import { map, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { toSignal } from '@angular/core/rxjs-interop';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { MatButtonModule } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { CalendarDatePipe } from 'angular-calendar/modules/common/calendar-date/calendar-date.pipe';
import { CalendarModule } from 'angular-calendar';

@Component({
  selector: 'dbx-calendar-base',
  standalone: true,
  imports: [MatButtonModule, MatButtonToggleModule, DbxButtonSpacerDirective, MatIconModule, CalendarModule, FlexLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.base.component.html'
})
export class DbxCalendarBaseComponent<T> {
  readonly calendarStore = inject(DbxCalendarStore<T>);

  readonly viewDate$ = this.calendarStore.date$;

  readonly showTodayButton$ = this.calendarStore.showTodayButton$;
  readonly canJumpToToday$ = this.calendarStore.canJumpToToday$;

  readonly isLookingAtMinimumDate$ = this.calendarStore.isLookingAtMinimumDate$;
  readonly isLookingAtMaximumDate$ = this.calendarStore.isLookingAtMaximumDate$;
  readonly hasMultiplePages$ = this.calendarStore.hasMultiplePages$;

  readonly showPageButtons$ = this.calendarStore.showPageButtons$;

  readonly activeDayIsOpen$ = this.calendarStore.eventsForDateState$.pipe(
    withLatestFrom(this.calendarStore.date$),
    map(([x, date]) => {
      if (x.events.length && isSameMonth(x.date, date)) {
        return !x.dateTappedTwice;
      }

      return false;
    })
  );

  readonly displayType$ = this.calendarStore.displayType$;

  readonly viewDateSignal = toSignal(this.viewDate$, { initialValue: new Date() });
  readonly showTodayButtonSignal = toSignal(this.showTodayButton$);
  readonly canJumpToTodaySignal = toSignal(this.canJumpToToday$);
  readonly isLookingAtMinimumDateSignal = toSignal(this.isLookingAtMinimumDate$);
  readonly isLookingAtMaximumDateSignal = toSignal(this.isLookingAtMaximumDate$);
  readonly hasMultiplePagesSignal = toSignal(this.hasMultiplePages$);
  readonly showPageButtonsSignal = toSignal(this.showPageButtons$);
  readonly activeDayIsOpenSignal = toSignal(this.activeDayIsOpen$);
  readonly displayTypeSignal = toSignal(this.displayType$);

  todayClicked(): void {
    this.calendarStore.tapDay(new Date());
  }

  firstPageButtonClicked(): void {
    this.calendarStore.tapFirstPage();
  }

  nextButtonClicked(): void {
    this.calendarStore.tapNext();
  }

  previousButtonClicked(): void {
    this.calendarStore.tapPrevious();
  }

  lastPageButtonClicked(): void {
    this.calendarStore.tapLastPage();
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
