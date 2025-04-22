import { DbxScheduleSelectionCalendarDateDaysComponent } from './calendar.schedule.selection.days.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective, DbxLabelBlockComponent } from '@dereekb/dbx-web';
import { DbxScheduleSelectionCalendarDateRangeComponent } from './calendar.schedule.selection.range.component';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-content',
  template: `
    <dbx-content-container padding="min" topPadding="normal">
      <dbx-schedule-selection-calendar-date-range [openPickerOnTextClick]="false"></dbx-schedule-selection-calendar-date-range>
      <dbx-label-block header="Allowed Days Of Week">
        <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
      </dbx-label-block>
    </dbx-content-container>
  `,
  imports: [DbxContentContainerDirective, DbxScheduleSelectionCalendarDateRangeComponent, DbxLabelBlockComponent, DbxScheduleSelectionCalendarDateDaysComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDatePopoverContentComponent {}
