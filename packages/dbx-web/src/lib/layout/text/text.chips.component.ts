import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
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
    @if (chips()) {
      <mat-chip-listbox class="dbx-text-chips-listbox">
        @for (chip of chips(); track chip.text) {
          <mat-chip-option [selected]="chip.selected ?? defaultSelection()" [color]="chip.color" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
            {{ chip.text }}
          </mat-chip-option>
        }
      </mat-chip-listbox>
    }
  `,
  imports: [MatChipsModule, MatTooltipModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTextChipsComponent<T = unknown> {
  readonly defaultSelection = input<Maybe<boolean>>();
  readonly chips = input<Maybe<TextChip<T>[]>>();
}
