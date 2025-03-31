import { Input, Directive, input, computed } from '@angular/core';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'large' | 'wide' | 'full';

/**
 * Component that limits the max-width of the content.
 */
@Directive({
  selector: 'dbx-content-container,[dbxContentContainer],.dbx-content-container',
  host: {
    class: 'd-block dbx-content-container',
    '[class]': `classConfig()`
  },
  standalone: true
})
export class DbxContentContainerDirective {
  readonly grow = input<DbxContentContainerWidth>('wide');
  readonly padding = input<DbxContentContainerPadding>('normal');
  readonly topPadding = input<DbxContentContainerPadding>('none');

  readonly classConfig = computed(() => {
    const classConfig = 'container-' + this.grow() + ' container-padding-' + this.padding() + ' container-top-padding-' + this.topPadding();
    return classConfig;
  });
}
