import { Component, ElementRef, Injector } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverContentComponent } from '@dereekb/dbx-web';
import { DbxPopoverScrollContentDirective } from '@dereekb/dbx-web';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverContentComponent } from './example.calendar.schedule.selection.popover.content.component';

export const DEFAULT_EXAMPLE_SCHEDULE_SELECTION_CALENDAR_DATE_POPOVER_KEY = 'examplecalendarselection';

export interface DocExtensionExampleScheduleSelectionCalendarDatePopoverConfig {
  origin: ElementRef;
  injector: Injector;
}

@Component({
  template: `
    <dbx-popover-content>
      <dbx-popover-scroll-content>
        <doc-example-schedule-selection-calendar-date-popover-content></doc-example-schedule-selection-calendar-date-popover-content>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  standalone: true,
  imports: [DbxPopoverContentComponent, DbxPopoverScrollContentDirective, DocExtensionExampleScheduleSelectionCalendarDatePopoverContentComponent]
})
export class DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent extends AbstractPopoverDirective<void> {
  static openPopover(popoverService: DbxPopoverService, { origin, injector }: DocExtensionExampleScheduleSelectionCalendarDatePopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<any, number> {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_EXAMPLE_SCHEDULE_SELECTION_CALENDAR_DATE_POPOVER_KEY,
      origin,
      componentClass: DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent,
      injector
    });
  }
}
