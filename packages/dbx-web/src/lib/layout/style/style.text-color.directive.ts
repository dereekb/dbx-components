import { computed, Directive, inject, input } from '@angular/core';
import { type DbxColorConfig, type DbxColorInput, DBX_COLOR_CUSTOM_TEXT_CSS_CLASS, isDbxColorConfig } from './style';
import { DbxColorService } from './style.color.service';
import { type Maybe } from '@dereekb/util';

/**
 * Applies a themed text color to the host element.
 *
 * Accepts either a {@link DbxThemeColor} string (e.g. `'primary'`, `'warn'`) or a {@link DbxColorConfig}
 * object carrying an arbitrary CSS color value. Unlike {@link DbxColorDirective} which sets the background,
 * this directive only sets the foreground text color.
 *
 * @dbxWebComponent
 * @dbxWebSlug text-color
 * @dbxWebCategory layout
 * @dbxWebRelated color, color-service
 * @dbxWebMinimalExample ```html
 * <span [dbxTextColor]="'primary'"></span>
 * ```
 *
 * @example
 * ```html
 * <mat-icon [dbxTextColor]="'warn'">error</mat-icon>
 * <span [dbxTextColor]="'primary'">Themed text</span>
 * <span [dbxTextColor]="{ color: '#0066ff' }">Custom hex text</span>
 * ```
 */
@Directive({
  selector: '[dbxTextColor]',
  host: {
    '[class]': 'cssClassSignal()',
    '[style.--dbx-color-current]': 'colorStyleSignal()'
  },
  standalone: true
})
export class DbxTextColorDirective {
  private readonly _colorService = inject(DbxColorService, { optional: true });

  readonly dbxTextColor = input<Maybe<DbxColorInput>>();

  private readonly _configSignal = computed<Maybe<DbxColorConfig>>(() => {
    const value = this.dbxTextColor();
    return isDbxColorConfig(value) ? (this._colorService?.expandColorConfig(value) ?? value) : undefined;
  });

  readonly cssClassSignal = computed(() => {
    const value = this.dbxTextColor();
    let result = '';

    if (isDbxColorConfig(value)) {
      result = DBX_COLOR_CUSTOM_TEXT_CSS_CLASS;
    } else if (value) {
      result = `dbx-${value}`;
    }

    return result;
  });

  /**
   * Inline `--dbx-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` in string mode so the named `.dbx-{color}` class supplies the variable instead.
   */
  readonly colorStyleSignal = computed(() => this._configSignal()?.color ?? null);
}
