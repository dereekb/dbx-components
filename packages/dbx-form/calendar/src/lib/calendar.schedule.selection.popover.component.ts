import { ChangeDetectionStrategy, Component, ElementRef, Injector } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService, DbxPopoverInteractionModule } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxScheduleSelectionCalendarDatePopoverContentComponent } from './calendar.schedule.selection.popover.content.component';

export const DEFAULT_SCHEDULE_SELECTION_CALENDAR_DATE_POPOVER_KEY = 'calendarselection';

export interface DbxScheduleSelectionCalendarDatePopoverConfig {
  origin: ElementRef;
  injector: Injector;
}

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover',
  template: `
    <dbx-popover-content>
      <dbx-popover-scroll-content>
        <dbx-schedule-selection-calendar-date-popover-content></dbx-schedule-selection-calendar-date-popover-content>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  imports: [DbxPopoverInteractionModule, DbxScheduleSelectionCalendarDatePopoverContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDatePopoverComponent extends AbstractPopoverDirective<void> {
  static openPopover(popoverService: DbxPopoverService, { origin, injector }: DbxScheduleSelectionCalendarDatePopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<any, number> {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_SCHEDULE_SELECTION_CALENDAR_DATE_POPOVER_KEY,
      origin,
      componentClass: DbxScheduleSelectionCalendarDatePopoverComponent,
      injector
    });
  }
}
