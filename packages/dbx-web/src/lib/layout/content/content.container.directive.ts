import { Input, Directive } from '@angular/core';
import { Maybe } from '@dereekb/util';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'large' | 'wide' | 'full';

/**
 * Component that limits the max-width of the content.
 */
@Directive({
  selector: 'dbx-content-container,[dbxContentContainer],.dbx-content-container',
  host: {
    class: 'd-block dbx-content-container',
    '[class]': `"container-" + grow + " container-padding-" + padding + " container-top-padding-" + topPadding`
  }
})
export class DbxContentContainerDirective {
  @Input()
  grow: DbxContentContainerWidth = 'wide';

  @Input()
  padding: DbxContentContainerPadding = 'normal';

  @Input()
  topPadding: DbxContentContainerPadding = 'none';
}
