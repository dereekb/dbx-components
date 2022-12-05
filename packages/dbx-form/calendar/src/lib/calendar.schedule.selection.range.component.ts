import { SubscriptionObject } from '@dereekb/rxjs';
import { Component, OnDestroy } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { FormGroup, FormControl } from '@angular/forms';
import { Maybe } from '@dereekb/util';
import { distinctUntilChanged } from 'rxjs';
import { isSameDate } from '@dereekb/date';
import { startOfDay } from 'date-fns';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-range',
  templateUrl: './calendar.schedule.selection.range.component.html'
})
export class DbxScheduleSelectionCalendarDateRangeComponent implements OnDestroy {
  private _syncSub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  readonly range = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  constructor(readonly dbxCalendarStore: DbxCalendarStore, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}

  ngOnInit(): void {
    this._syncSub.subscription = this.dbxCalendarScheduleSelectionStore.inputStartAndEnd$.subscribe((x) => {
      this.range.setValue({
        start: x.inputStart ?? null,
        end: x.inputEnd ?? null
      });
    });

    this._valueSub.subscription = this.range.valueChanges.pipe(distinctUntilChanged((a, b) => isSameDate(a.start, b.start) && isSameDate(a.end, b.end))).subscribe((x) => {
      let inputStart = x.start ? startOfDay(x.start) : null;
      let inputEnd = x.end ? startOfDay(x.end) : null;
      this.dbxCalendarScheduleSelectionStore.setInputRange({ inputStart, inputEnd });
    });
  }

  ngOnDestroy(): void {
    this._syncSub.destroy();
    this._valueSub.destroy();
  }
}
