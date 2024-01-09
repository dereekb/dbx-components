import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

export interface TextChip<T = unknown> {
  text: string;
  tooltip?: string;
  selected?: boolean;
  color?: 'primary' | 'accent' | 'warn' | undefined;
  data?: T;
}

@Component({
  selector: 'dbx-text-chips',
  template: `
    <mat-chip-listbox class="dbx-text-chips-listbox" *ngIf="chips">
      <mat-chip-option *ngFor="let chip of chips; trackBy: trackChipByText" [selected]="chip.selected ?? defaultSelection" [color]="chip.color" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
        {{ chip.text }}
      </mat-chip-option>
    </mat-chip-listbox>
  `
})
export class DbxTextChipsComponent<T = unknown> {
  @Input()
  defaultSelection?: boolean;

  @Input()
  chips?: Maybe<TextChip<T>[]>;

  trackChipByText(index: number, chip: TextChip<T>) {
    return chip.text;
  }
}
