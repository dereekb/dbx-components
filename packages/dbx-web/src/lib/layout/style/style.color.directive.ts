import { computed, Directive, inject, input, model } from '@angular/core';
import { type DbxColorConfig, type DbxColorInput, type DbxColorTone, dbxColorBackground, isDbxColorConfig } from './style';
import { DbxColorService } from './style.color.service';
import { type Maybe } from '@dereekb/util';

/**
 * Provides themed color *tokens* to the host element — it never paints a background itself.
 *
 * Accepts either a {@link DbxThemeColor} string (e.g. `'primary'`, `'success'`) or a {@link DbxColorConfig}
 * object carrying arbitrary CSS color values (any hex, `rgb()`, `hsl()`, `var(...)`, `color-mix(...)`, etc.).
 * The directive sets the `--dbx-bg-color-current` / `--dbx-color-current` (and tone) custom properties and adds the
 * `.dbx-color` marker class, leaving the actual painting to either the explicit `.dbx-color-bg` utility on the same
 * element or a colored-surface component's own `.dbx-color`-scoped SCSS (e.g. `<dbx-bar>`, `<dbx-button>`, `<dbx-loading>`,
 * `<dbx-icon-tile>`, `<mat-card>`) that reads the inherited tokens.
 *
 * Optionally set {@link dbxColorTone} (0-100) to control background opacity for a tonal/muted appearance.
 * When tonal mode is active, the `dbx-color-tonal` CSS class is added and a CSS rule overrides the text
 * color to the vibrant color (via `--dbx-bg-color-current`).
 *
 * The standalone `[dbxColorTone]` input wins over `config.tone` when both are set; the same precedence
 * applies to tonal mode.
 *
 * @dbxWebComponent
 * @dbxWebSlug color
 * @dbxWebCategory layout
 * @dbxWebRelated text-color, color-service
 * @dbxWebMinimalExample ```html
 * <div dbxColor="primary" class="dbx-color-bg"></div>
 * ```
 *
 * @example
 * ```html
 * <!-- pair with .dbx-color-bg to paint a plain element -->
 * <div dbxColor="primary" class="dbx-color-bg">Themed background</div>
 * <div dbxColor="primary" [dbxColorTone]="18" class="dbx-color-bg">Tonal themed</div>
 * <div [dbxColor]="{ color: '#ff0066', contrast: 'white' }" class="dbx-color-bg">Custom hex</div>
 *
 * <!-- a colored-surface component paints itself from the tokens; no .dbx-color-bg needed -->
 * <dbx-bar dbxColor="primary">Bar paints itself</dbx-bar>
 * <dbx-button color="warn" raised text="Delete"></dbx-button>
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

  /**
   * The color to provide tokens for. Declared as a `model` so a colored-surface component on the same host (e.g.
   * `dbx-button`) can push its resolved color into the directive, keeping it the single token provider on the element.
   */
  readonly dbxColor = model<Maybe<DbxColorInput>>();

  /**
   * Background tone level (0-100). When set, the background becomes semi-transparent
   * and text color switches to the vibrant theme color for a tonal appearance.
   */
  readonly dbxColorTone = input<Maybe<DbxColorTone>>();

  /**
   * Applies the named `dbx-{color}-bg` token class for a {@link DbxThemeColor} string, `dbx-default` when nullish, or
   * `''` for a {@link DbxColorConfig} (whose tokens are supplied by the inline `--dbx-bg-color-current` / `--dbx-color-current`
   * style bindings instead). The directive is a pure token provider — none of these classes paint a background; painting is
   * done by the `.dbx-color-bg` utility or a component's own `.dbx-color`-scoped SCSS.
   */
  readonly cssClassSignal = computed(() => {
    const value = this.dbxColor();
    return isDbxColorConfig(value) ? '' : dbxColorBackground(value);
  });

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
    const _config = this._configSignal();
    const inputTone = this.dbxColorTone();
    return inputTone ?? _config?.tone;
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
    const _config = this._configSignal();
    const inputTone = this.dbxColorTone();
    let tonal = false;

    if (inputTone == null) {
      const config = _config;

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
