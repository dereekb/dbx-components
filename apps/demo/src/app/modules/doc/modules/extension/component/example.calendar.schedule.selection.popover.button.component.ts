import { DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent } from './example.calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, inject, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { DbxPopoverService, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxCalendarScheduleSelectionStore } from '@dereekb/dbx-form/calendar';

@Component({
  selector: 'doc-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [raised]="true" color="accent" text="Custom Button" (buttonClick)="openPopover()"></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent {
  readonly popoverService = inject(DbxPopoverService);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);
  readonly injector = inject(Injector);

  readonly buttonPopoverOrigin = viewChild.required('buttonPopoverOrigin', { read: ElementRef });

  openPopover() {
    DocExtensionExampleScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin(), injector: this.injector });
  }
}
