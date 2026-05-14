import { computed, Directive, inject, input } from '@angular/core';
import { type DbxColorConfig, type DbxColorInput, type DbxColorTone, dbxColorBackground, isDbxColorConfig } from './style';
import { DbxColorService } from './style.color.service';
import { type Maybe } from '@dereekb/util';

/**
 * Applies a themed background color to the host element.
 *
 * Accepts either a {@link DbxThemeColor} string (e.g. `'primary'`, `'success'`) or a {@link DbxColorConfig}
 * object carrying arbitrary CSS color values (any hex, `rgb()`, `hsl()`, `var(...)`, `color-mix(...)`, etc.).
 *
 * Optionally set {@link dbxColorTone} (0-100) to control background opacity for a tonal/muted appearance.
 * When tonal mode is active, the `dbx-color-tonal` CSS class is added and a CSS rule overrides the text
 * color to the vibrant color (via `--dbx-bg-color-current`).
 *
 * The standalone `[dbxColorTone]` input wins over `config.tone` when both are set; the same precedence
 * applies to tonal mode.
 *
 * @example
 * ```html
 * <div [dbxColor]="'primary'">Themed background</div>
 * <div [dbxColor]="'primary'" [dbxColorTone]="18">Tonal themed</div>
 * <div [dbxColor]="{ color: '#ff0066', contrast: 'white' }">Custom hex</div>
 * <div [dbxColor]="{ color: 'var(--mat-sys-tertiary)', contrast: 'var(--mat-sys-on-tertiary)', tone: 18 }">Custom tonal</div>
 * ```
 */
@Directive({
  selector: '[dbxColor]',
  host: {
    '[class]': 'cssClassSignal()',
    '[class.dbx-color]': 'true',
    '[class.dbx-color-tonal]': 'isTonalSignal()',
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()',
    '[style.--dbx-bg-color-current]': 'bgColorStyleSignal()',
    '[style.--dbx-color-current]': 'colorStyleSignal()'
  },
  standalone: true
})
export class DbxColorDirective {
  private readonly _colorService = inject(DbxColorService, { optional: true });

  readonly dbxColor = input<Maybe<DbxColorInput>>();

  /**
   * Background tone level (0-100). When set, the background becomes semi-transparent
   * and text color switches to the vibrant theme color for a tonal appearance.
   */
  readonly dbxColorTone = input<Maybe<DbxColorTone>>();

  readonly cssClassSignal = computed(() => dbxColorBackground(this.dbxColor()));

  private readonly _configSignal = computed<Maybe<DbxColorConfig>>(() => {
    const value = this.dbxColor();
    return isDbxColorConfig(value) ? (this._colorService?.expandColorConfig(value) ?? value) : undefined;
  });

  /**
   * Inline `--dbx-bg-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` in string mode so the named `.dbx-{color}-bg` class supplies the variable instead.
   */
  readonly bgColorStyleSignal = computed(() => this._configSignal()?.color ?? null);

  /**
   * Inline `--dbx-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` (and inherits from the named bg class) when omitted or in string mode.
   */
  readonly colorStyleSignal = computed(() => this._configSignal()?.contrast ?? null);

  /**
   * Effective tone used for opacity. The standalone `[dbxColorTone]` input wins when set; otherwise `config.tone` applies.
   */
  readonly effectiveToneSignal = computed<Maybe<DbxColorTone>>(() => {
    const inputTone = this.dbxColorTone();
    return inputTone ?? this._configSignal()?.tone;
  });

  /**
   * Whether tonal mode is active. Adds the `dbx-color-tonal` CSS class which
   * overrides the text color to the vibrant theme color via CSS rather than
   * an inline style binding (which would conflict with `[ngStyle]`).
   *
   * Precedence: an input-tone always implies tonal (existing behavior); otherwise
   * `config.tonal` wins when explicitly set, then falls back to inferring tonal mode
   * from `config.tone`.
   */
  readonly isTonalSignal = computed(() => {
    const inputTone = this.dbxColorTone();
    let tonal = false;

    if (inputTone == null) {
      const config = this._configSignal();

      if (config?.tonal != null) {
        tonal = config.tonal;
      } else if (config?.tone != null) {
        tonal = true;
      }
    } else {
      tonal = true;
    }

    return tonal;
  });

  /**
   * Sets `--dbx-color-bg-tone` on the host to control the background opacity via `color-mix` in the `-bg` class mixin.
   */
  readonly bgToneStyleSignal = computed(() => {
    const tone = this.effectiveToneSignal();
    return tone == null ? null : `${tone}%`;
  });
}
