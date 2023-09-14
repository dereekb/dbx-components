import { Component, Injector, Input, OnDestroy } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { BehaviorSubject, distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Toggle button for selecting and clearing the current selection.
 */
@Component({
  selector: 'dbx-schedule-selection-calendar-selection-toggle-button',
  template: `
    <dbx-button [disabled]="disableButton$ | async" [buttonDisplay]="buttonDisplay$ | async" [raised]="true" (buttonClick)="toggleSelection()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarSelectionToggleButtonComponent implements OnDestroy {
  private _disabled = new BehaviorSubject<Maybe<boolean>>(false);

  readonly disableButton$ = this._disabled.pipe(
    switchMap((disabled) => {
      if (disabled) {
        return of(true);
      } else {
        return this.dbxCalendarScheduleSelectionStore.nextToggleSelection$.pipe(map((x) => !x));
      }
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

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
            text: 'Clear All'
          };
          break;
      }

      return buttonDisplay;
    }),
    shareReplay(1)
  );

  constructor(readonly popoverService: DbxPopoverService, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, readonly injector: Injector) {}

  ngOnDestroy(): void {
    this._disabled.complete();
  }

  toggleSelection() {
    this.dbxCalendarScheduleSelectionStore.toggleSelection();
  }

  @Input()
  set disabled(disabled: Maybe<boolean>) {
    this._disabled.next(disabled);
  }
}
