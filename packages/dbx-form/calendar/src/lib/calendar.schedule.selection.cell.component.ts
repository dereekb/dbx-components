import { Component, inject, ChangeDetectionStrategy, input, signal, computed, Signal } from '@angular/core';
import { CalendarMonthViewDay } from 'angular-calendar';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionCellContent, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';
import { MatIconModule } from '@angular/material/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, shareReplay, switchMap } from 'rxjs';

@Component({
  selector: 'dbx-schedule-selection-calendar-cell',
  template: `
    @if (iconSignal()) {
      <mat-icon>{{ iconSignal() }}</mat-icon>
    }
    <span>{{ textSignal() }}</span>
  `,
  host: {
    class: 'dbx-schedule-selection-calendar-cell'
  },
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarCellComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly day = input.required<CalendarMonthViewDay<CalendarScheduleSelectionMetadata>>();
  readonly day$ = toObservable(this.day);

  readonly cellContent$ = this.dbxCalendarScheduleSelectionStore.cellContentFactory$.pipe(
    switchMap((fn) => this.day$.pipe(map((x) => fn(x)))),
    shareReplay(1)
  );

  readonly contentSignal: Signal<CalendarScheduleSelectionCellContent> = toSignal(this.cellContent$, { initialValue: {} });

  readonly iconSignal = computed(() => this.contentSignal().icon);
  readonly textSignal = computed(() => this.contentSignal().text);
}
