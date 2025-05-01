import { DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent } from './example.calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, ViewChild, inject } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DbxCalendarScheduleSelectionStore } from '@dereekb/dbx-form/calendar';
import { DbxButtonComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [raised]="true" color="accent" text="Custom Button" (buttonClick)="openPopover()"></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent]
})
export class DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent {
  readonly popoverService = inject(DbxPopoverService);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);
  readonly injector = inject(Injector);

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  openPopover() {
    DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin, injector: this.injector });
  }
}
