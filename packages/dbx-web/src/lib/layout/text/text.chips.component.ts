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
    <mat-chip-list *ngIf="chips" [multiple]="false">
      <mat-chip *ngFor="let chip of chips" selected [color]="chip.color" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
        {{ chip.text }}
      </mat-chip>
    </mat-chip-list>
  `
})
export class DbxTextChipsComponent<T = unknown> {
  @Input()
  chips?: Maybe<TextChip<T>[]>;
}
