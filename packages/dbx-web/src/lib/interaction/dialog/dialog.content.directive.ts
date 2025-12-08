import { computed, Directive, input } from '@angular/core';
import { Maybe } from '@dereekb/util';

export type DbxDialogContentContainerWidth = 'normal' | 'wide';

/**
 * Component used to style a dialog.
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
