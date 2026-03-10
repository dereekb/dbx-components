import { computed, Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Width mode for dialog content containers.
 */
export type DbxDialogContentContainerWidth = 'normal' | 'wide';

/**
 * Directive that applies standard dialog content styling and width configuration.
 *
 * Can be used as an element, attribute, or CSS class selector.
 *
 * @example
 * ```html
 * <dbx-dialog-content [width]="'wide'">
 *   <p>Dialog body content here.</p>
 * </dbx-dialog-content>
 * ```
 */
@Directive({
  selector: 'dbx-dialog-content,[dbxDialogContent],.dbx-dialog-content',
  host: {
    class: 'dbx-dialog-content',
    '[class]': `classConfig()`
  },
  standalone: true
})
export class DbxDialogContentDirective {
  readonly width = input<DbxDialogContentContainerWidth, Maybe<DbxDialogContentContainerWidth>>('normal', { transform: (x) => x ?? 'normal' });

  readonly classConfig = computed(() => `${this.width()}-dialog-content`);
}
