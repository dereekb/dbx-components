import { Directive, input, computed } from '@angular/core';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type DbxColorTone, type DbxThemeColor, dbxColorBackground } from '../style/style';

/**
 * Display configuration for a single colored chip.
 *
 * Combines a labeled value with a theme color for rendering a styled chip.
 */
export interface DbxChipDisplay<T = unknown> extends LabeledValue<T> {
  /**
   * Theme color applied to the chip background.
   */
  readonly color?: Maybe<DbxThemeColor>;
  /**
   * Whether to render the chip in small mode.
   */
  readonly small?: Maybe<boolean>;
  /**
   * Whether to render the chip in block mode (no border-radius).
   */
  readonly block?: Maybe<boolean>;
  /**
   * Background tone level controlling the opacity of the chip color.
   */
  readonly tone?: Maybe<DbxColorTone>;
}

/**
 * Default background tone percentage for tonal chip coloring.
 */
export const DBX_CHIP_DEFAULT_TONE = 18;

/**
 * Renders a styled chip element with optional small, block, and color modes.
 *
 * @example
 * ```html
 * <dbx-chip [small]="true">Tag</dbx-chip>
 * <dbx-chip [block]="true">Full Width</dbx-chip>
 * <dbx-chip [color]="'primary'">Primary</dbx-chip>
 * ```
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'dbx-chip',
  host: {
    class: 'dbx-chip mat-standard-chip',
    '[class]': 'styleSignal()',
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()',
    '[style.color]': 'tonalColorSignal()'
  },
  standalone: true
})
export class DbxChipDirective {
  readonly small = input<Maybe<boolean>>();
  readonly block = input<Maybe<boolean>>();

  /**
   * Theme color applied to the chip background via {@link dbxColorBackground}.
   *
   * When {@link display} is also set, its color is used as a fallback.
   */
  readonly color = input<Maybe<DbxThemeColor>>();
  /**
   * Display configuration that provides color (and optionally label/value metadata).
   *
   * The color from `display` is used as a fallback when `color` is not explicitly set.
   */
  readonly display = input<Maybe<DbxChipDisplay>>();
  /**
   * Background tone level for tonal appearance. Defaults to {@link DBX_CHIP_DEFAULT_TONE}.
   *
   * Set to `100` for fully opaque background.
   */
  readonly tone = input<Maybe<DbxColorTone>>();

  readonly colorSignal = computed(() => this.color() ?? this.display()?.color);

  readonly toneSignal = computed(() => this.tone() ?? this.display()?.tone ?? DBX_CHIP_DEFAULT_TONE);

  readonly styleSignal = computed(() => {
    const display = this.display();
    const small = this.small() ?? display?.small;
    const block = this.block() ?? display?.block;
    const color = this.colorSignal();

    let style = small ? 'dbx-chip-small' : '';

    if (block) {
      style = style + ' dbx-chip-block';
    }

    if (color) {
      style = style + ' ' + dbxColorBackground(color);
    }

    return style;
  });

  /**
   * Sets `--dbx-color-bg-tone` on the host to control the background opacity via `color-mix` in the `-bg` class mixin.
   * Only applied when a color is set.
   */
  readonly bgToneStyleSignal = computed(() => {
    const color = this.colorSignal();

    if (color) {
      return `${this.toneSignal()}%`;
    }

    return null;
  });

  /**
   * Overrides the host text color to use the vibrant theme color when tonal mode is active.
   *
   * Normally a `-bg` class sets the contrast color as text (e.g. white on blue).
   * In tonal mode the background is semi-transparent, so white text would be unreadable.
   * Instead we use `--dbx-bg-color-current` (the vibrant color set by the `-bg` mixin) as the text color.
   */
  readonly tonalColorSignal = computed(() => {
    const color = this.colorSignal();
    return color && this.toneSignal() < 100 ? 'var(--dbx-bg-color-current)' : null;
  });
}
