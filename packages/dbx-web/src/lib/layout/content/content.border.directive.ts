import { computed, Directive, input } from '@angular/core';
import { type DbxThemeColor } from '../style/style';

/**
 * Wraps the host element in a themed border with internal padding. The border color
 * can be set to any theme color (defaults to `'default'`).
 *
 * @example
 * ```html
 * <dbx-content-border color="primary">
 *   <p>Content inside a primary-colored border.</p>
 * </dbx-content-border>
 *
 * <div dbxContentBorder color="warn">
 *   <p>Warning-bordered content.</p>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-content-border,[dbxContentBorder]',
  host: {
    class: 'd-block dbx-content-border',
    '[class]': `classConfig()`
  },
  standalone: true
})
export class DbxContentBorderDirective {
  readonly color = input<DbxThemeColor>('default');
  readonly classConfig = computed(() => `dbx-content-border-${this.color()}`);
}
