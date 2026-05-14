import { Directive, computed, inject, input } from '@angular/core';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type DbxColorConfig, type DbxColorInput, type DbxColorTone, dbxColorBackground, isDbxColorConfig } from '../style/style';
import { DbxColorService } from '../style/style.color.service';

/**
 * Display configuration for a single colored chip.
 *
 * Combines a labeled value with a theme color for rendering a styled chip.
 */
export interface DbxChipDisplay extends LabeledValue<string> {
  /**
   * Optional unique key for tracking in `@for` loops. Falls back to `label` when not provided.
   */
  readonly key?: string;
  /**
   * Theme color or {@link DbxColorConfig} applied to the chip background.
   */
  readonly color?: Maybe<DbxColorInput>;
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
 * @dbxWebComponent
 * @dbxWebSlug chip
 * @dbxWebCategory text
 * @dbxWebRelated chip-list
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-chip text="Tag"></dbx-chip>
 * ```
 *
 * @example
 * ```html
 * <dbx-chip text="Active" icon="check" color="primary"></dbx-chip>
 * ```
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'dbx-chip',
  host: {
    class: 'dbx-chip mat-standard-chip',
    '[class]': 'styleSignal()',
    '[class.dbx-color-tonal]': 'isTonalSignal()',
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()',
    '[style.--dbx-bg-color-current]': 'bgColorStyleSignal()',
    '[style.--dbx-color-current]': 'colorStyleSignal()'
  },
  standalone: true
})
export class DbxChipDirective {
  private readonly _colorService = inject(DbxColorService, { optional: true });

  readonly small = input<Maybe<boolean>>();
  readonly block = input<Maybe<boolean>>();

  /**
   * Theme color or {@link DbxColorConfig} applied to the chip background via {@link dbxColorBackground}.
   *
   * When {@link display} is also set, its color is used as a fallback.
   */
  readonly color = input<Maybe<DbxColorInput>>();
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

  private readonly _configSignal = computed<Maybe<DbxColorConfig>>(() => {
    const value = this.colorSignal();
    return isDbxColorConfig(value) ? (this._colorService?.expandColorConfig(value) ?? value) : undefined;
  });

  /**
   * Inline `--dbx-bg-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` for named-color strings so the named `.dbx-{color}-bg` class supplies the variable instead.
   */
  readonly bgColorStyleSignal = computed(() => this._configSignal()?.color ?? null);

  /**
   * Inline `--dbx-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` for named-color strings.
   */
  readonly colorStyleSignal = computed(() => this._configSignal()?.contrast ?? null);

  readonly toneSignal = computed(() => this.tone() ?? this.display()?.tone ?? this._configSignal()?.tone ?? DBX_CHIP_DEFAULT_TONE);

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
   * Whether tonal mode is active (color is set and tone < 100). Adds the `dbx-color-tonal`
   * CSS class which overrides text color to the vibrant theme color via CSS rather than
   * an inline style binding (which would conflict with `[ngStyle]`).
   */
  readonly isTonalSignal = computed(() => {
    const color = this.colorSignal();
    return Boolean(color) && this.toneSignal() < 100;
  });
}
