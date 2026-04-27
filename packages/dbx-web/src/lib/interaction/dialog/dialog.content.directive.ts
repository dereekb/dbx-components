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
 * @dbxWebComponent
 * @dbxWebSlug dialog-content
 * @dbxWebCategory overlay
 * @dbxWebRelated popover, popup, prompt
 * @dbxWebSkillRefs dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <div dbxDialogContent>Body</div>
 * ```
 *
 * @example
 * ```html
 * <dbx-dialog-content>
 *   <h2>Confirm</h2>
 *   <p>Are you sure?</p>
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
