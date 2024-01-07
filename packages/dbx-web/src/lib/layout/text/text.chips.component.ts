import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

export interface TextChip<T = unknown> {
  text: string;
  tooltip?: string;
  color?: 'primary' | 'accent';
  data?: T;
}

@Component({
  selector: 'dbx-text-chips',
  template: `
    <mat-chip-set *ngIf="chips">
      <mat-chip *ngFor="let chip of chips; trackBy: trackChipByText" selected [color]="chip.color" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
        {{ chip.text }}
      </mat-chip>
    </mat-chip-set>
  `
})
export class DbxTextChipsComponent<T = unknown> {
  @Input()
  chips?: Maybe<TextChip<T>[]>;

  trackChipByText(index: number, chip: TextChip<T>) {
    return chip.text;
  }
}
