import { Component, Input } from '@angular/core';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'wide' | 'full';

/**
 * Component that limits the max-width of the content.
 */
@Component({
  selector: 'dbx-content-container',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'd-block dbx-content-container',
    '[class]': `"container-" + grow + " container-padding-" + padding`
  }
})
export class DbxContentContainerComponent {

  @Input()
  grow = 'wide';

  @Input()
  padding = 'normal';

}
