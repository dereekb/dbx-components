import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, ViewChild } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { of } from 'rxjs';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [raised]="true" color="accent" [text]="buttonText$ | async" (buttonClick)="openPopover()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarDatePopoverButtonComponent {
  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  readonly buttonText$ = of('Pick Date Range');

  constructor(readonly popoverService: DbxPopoverService, readonly injector: Injector) {}

  openPopover() {
    DbxScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin, injector: this.injector });
  }
}
