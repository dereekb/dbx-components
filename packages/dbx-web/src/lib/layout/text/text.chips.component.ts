import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatChipListbox, MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type Maybe } from '@dereekb/util';

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
      @for (chip of chips; track chip.text) {
        <mat-chip-option [selected]="chip.selected ?? defaultSelection" [color]="chip.color" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
          {{ chip.text }}
        </mat-chip-option>
      }
    </mat-chip-listbox>
  `,
  imports: [MatChipsModule, MatTooltipModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTextChipsComponent<T = unknown> {
  @Input()
  defaultSelection?: boolean;

  @Input()
  chips?: Maybe<TextChip<T>[]>;
}
