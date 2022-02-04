import { Component, Input } from '@angular/core';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'wide' | 'full';

/**
 * Component that limits the max-width of the content.
 */
@Component({
  selector: 'dbx-content-container',
  template: `
    <div class="dbx-content-container" [ngClass]="grow + '-container container-padding-' + padding">
      <ng-content></ng-content>
    </div>
  `
})
export class DbxContentContainerComponent {

  @Input()
  grow = 'wide';

  @Input()
  padding = 'normal';

}
