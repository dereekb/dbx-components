import { Component, Injector } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { map, shareReplay } from 'rxjs';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';

/**
 * Toggle button for selecting and clearing the current selection.
 */
@Component({
  selector: 'dbx-schedule-selection-calendar-selection-toggle-button',
  template: `
    <dbx-button [disabled]="disableButton$ | async" [buttonDisplay]="buttonDisplay$ | async" [raised]="true" (buttonClick)="toggleSelection()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarSelectionToggleButtonComponent {
  readonly disableButton$ = this.dbxCalendarScheduleSelectionStore.nextToggleSelection$.pipe(map((x) => !x));

  readonly buttonDisplay$ = this.dbxCalendarScheduleSelectionStore.nextToggleSelection$.pipe(
    map((x) => {
      let buttonDisplay: DbxButtonDisplayContent;

      switch (x) {
        case 'all':
          buttonDisplay = {
            icon: 'select_all',
            text: 'Select All'
          };
          break;
        default:
        case 'none':
          buttonDisplay = {
            icon: 'clear',
            text: 'Clear Selection'
          };
          break;
      }

      return buttonDisplay;
    }),
    shareReplay(1)
  );

  constructor(readonly popoverService: DbxPopoverService, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, readonly injector: Injector) {}

  toggleSelection() {
    this.dbxCalendarScheduleSelectionStore.toggleSelection();
  }
}
