import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type DbxColorConfig, type DbxColorInput, dbxColorBackground, isDbxColorConfig } from '../style/style';
import { DbxColorService } from '../style/style.color.service';

/**
 * Configuration for a single chip displayed by {@link DbxTextChipsComponent}.
 *
 * Extends {@link LabeledValue} for the chip label and value.
 */
export interface TextChip extends LabeledValue<string> {
  /**
   * Optional unique key for tracking in `@for` loops. Falls back to `label` when not provided.
   */
  readonly key?: string;
  /**
   * Optional tooltip shown on hover.
   */
  readonly tooltip?: string;
  /**
   * Whether the chip appears selected.
   */
  readonly selected?: boolean;
  /**
   * Theme color or {@link DbxColorConfig} applied to the chip background via {@link dbxColorBackground}.
   */
  readonly color?: Maybe<DbxColorInput>;
}

/**
 * Renders a read-only list of Material chip options from an array of {@link TextChip} objects.
 *
 * @example
 * ```html
 * <dbx-text-chips [chips]="[{ label: 'Active', value: 'active', selected: true, color: 'primary' }]"></dbx-text-chips>
 * ```
 */
@Component({
  selector: 'dbx-text-chips',
  template: `
    @if (chips()) {
      <mat-chip-listbox class="dbx-text-chips-listbox">
        @for (chip of chips(); track chip.key ?? chip.label) {
          <mat-chip-option [selected]="chip.selected ?? defaultSelection()" [class]="chipColorClass(chip)" [style.--dbx-bg-color-current]="chipBgColorStyle(chip)" [style.--dbx-color-current]="chipColorStyle(chip)" [matTooltip]="chip.tooltip!" matTooltipPosition="above">
            {{ chip.label }}
          </mat-chip-option>
        }
      </mat-chip-listbox>
    }
  `,
  imports: [MatChipsModule, MatTooltipModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTextChipsComponent {
  private readonly _colorService = inject(DbxColorService, { optional: true });

  readonly defaultSelection = input<Maybe<boolean>>();
  readonly chips = input<Maybe<TextChip[]>>();

  /**
   * Returns the themed background CSS class for a chip's color.
   *
   * @param chip - The chip to get the color class for.
   * @returns The CSS class name for the chip's background color, or empty string if no color.
   */
  chipColorClass(chip: TextChip): string {
    return chip.color ? dbxColorBackground(chip.color) : '';
  }

  /**
   * Returns the inline `--dbx-bg-color-current` value for a chip when its color is a {@link DbxColorConfig}; otherwise null.
   *
   * @param chip - The chip.
   * @returns The background color CSS value, or null for named-color strings.
   */
  chipBgColorStyle(chip: TextChip): Maybe<string> {
    return this._expandedChipConfig(chip)?.color ?? null;
  }

  /**
   * Returns the inline `--dbx-color-current` value for a chip when its color is a {@link DbxColorConfig}; otherwise null.
   *
   * @param chip - The chip.
   * @returns The contrast color CSS value, or null for named-color strings.
   */
  chipColorStyle(chip: TextChip): Maybe<string> {
    return this._expandedChipConfig(chip)?.contrast ?? null;
  }

  private _expandedChipConfig(chip: TextChip): Maybe<DbxColorConfig> {
    const value = chip.color;
    return isDbxColorConfig(value) ? (this._colorService?.expandColorConfig(value) ?? value) : undefined;
  }
}
