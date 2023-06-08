import { DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent } from './example.calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, ViewChild } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DbxCalendarScheduleSelectionStore } from '@dereekb/dbx-form/calendar';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [raised]="true" color="accent" text="Custom Button" (buttonClick)="openPopover()"></dbx-button>
  `
})
export class DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent {
  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  constructor(readonly popoverService: DbxPopoverService, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, readonly injector: Injector) {}

  openPopover() {
    DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin, injector: this.injector });
  }
}
