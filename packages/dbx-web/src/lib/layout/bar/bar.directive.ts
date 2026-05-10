import { computed, Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxColorInput, dbxColorBackground, isDbxColorConfig } from '../style/style';

/**
 * Renders a horizontal bar with a themed background color, used to visually group or separate content.
 *
 * @dbxWebComponent
 * @dbxWebSlug bar
 * @dbxWebCategory layout
 * @dbxWebRelated bar-header, pagebar, button-spacer
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-bar><button>A</button><button>B</button></dbx-bar>
 * ```
 *
 * @example
 * ```html
 * <dbx-bar>
 *   <dbx-button text="Save" raised color="primary"></dbx-button>
 *   <dbx-button-spacer></dbx-button-spacer>
 *   <dbx-button text="Cancel" stroked></dbx-button>
 * </dbx-bar>
 * ```
 */
@Directive({
  selector: 'dbx-bar,[dbxBar]',
  host: {
    class: 'dbx-bar',
    '[class]': 'cssClassSignal()',
    '[style.--dbx-bg-color-current]': 'bgColorStyleSignal()',
    '[style.--dbx-color-current]': 'colorStyleSignal()'
  },
  standalone: true
})
export class DbxBarDirective {
  readonly color = input<Maybe<DbxColorInput>>();

  readonly cssClassSignal = computed(() => {
    const color = this.color();
    return color ? dbxColorBackground(color) : '';
  });

  private readonly _configSignal = computed(() => {
    const value = this.color();
    return isDbxColorConfig(value) ? value : undefined;
  });

  /**
   * Inline `--dbx-bg-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` for named-color strings.
   */
  readonly bgColorStyleSignal = computed(() => this._configSignal()?.color ?? null);

  /**
   * Inline `--dbx-color-current` value applied when a {@link DbxColorConfig} is bound. Resolves to `null` for named-color strings.
   */
  readonly colorStyleSignal = computed(() => this._configSignal()?.contrast ?? null);
}
