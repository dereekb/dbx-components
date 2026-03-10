import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type Maybe } from '@dereekb/util';

/**
 * Configuration for a single chip displayed by {@link DbxTextChipsComponent}.
 */
export interface TextChip<T = unknown> {
  /** Display label for the chip. */
  text: string;
  /** Optional tooltip shown on hover. */
  tooltip?: string;
  /** Whether the chip appears selected. */
  selected?: boolean;
  /** Theme color applied to the chip. */
  color?: 'primary' | 'accent' | 'warn' | undefined;
  /** Arbitrary data payload associated with the chip. */
  data?: T;
}

/**
 * Renders a read-only list of Material chip options from an array of {@link TextChip} objects.
 *
 * @example
 * ```html
 * <dbx-text-chips [chips]="[{ text: 'Active', selected: true, color: 'primary' }]"></dbx-text-chips>
 * ```
 */
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
