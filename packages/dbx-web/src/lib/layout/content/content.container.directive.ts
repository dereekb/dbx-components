import { Input, Directive } from '@angular/core';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'wide' | 'full';

/**
 * Component that limits the max-width of the content.
 */
@Directive({
  selector: 'dbx-content-container,[dbx-content-container],.dbx-content-container',
  host: {
    'class': 'd-block dbx-content-container',
    '[class]': `"container-" + grow + " container-padding-" + padding`
  }
})
export class DbxContentContainerDirective {

  @Input()
  grow = 'wide';

  @Input()
  padding = 'normal';

}
