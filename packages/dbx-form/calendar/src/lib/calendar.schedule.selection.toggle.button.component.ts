import { Component, inject, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Toggle button for selecting and clearing the current selection.
 */
@Component({
  selector: 'dbx-schedule-selection-calendar-selection-toggle-button',
  template: `
    <dbx-button [disabled]="disableButtonSignal()" [buttonDisplay]="buttonDisplaySignal()" [raised]="true" (buttonClick)="toggleSelection()"></dbx-button>
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarSelectionToggleButtonComponent {
  readonly disabled = input<Maybe<boolean>>();
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly selectionModeSignal = toSignal(this.dbxCalendarScheduleSelectionStore.selectionMode$, { initialValue: 'multiple' });
  readonly nextToggleSelectionSignal = toSignal(this.dbxCalendarScheduleSelectionStore.nextToggleSelection$, { initialValue: 'none' });

  readonly disableButtonSignal = computed(() => {
    const disabled = this.disabled();
    const nextToggleSelection = this.nextToggleSelectionSignal();
    let disableButton = false;

    if (disabled) {
      disableButton = true;
    } else {
      disableButton = !nextToggleSelection;
    }

    return disableButton;
  });

  readonly buttonDisplaySignal = computed(() => {
    const selectionMode = this.selectionModeSignal();
    const nextToggleSelection = this.nextToggleSelectionSignal();

    let buttonDisplay: DbxButtonDisplay;

    switch (nextToggleSelection) {
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
          text: selectionMode === 'multiple' ? 'Clear All' : 'Clear'
        };
        break;
    }

    console.log({ buttonDisplay });

    return buttonDisplay;
  });

  toggleSelection() {
    this.dbxCalendarScheduleSelectionStore.toggleSelection();
  }
}
