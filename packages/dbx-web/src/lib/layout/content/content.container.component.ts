import { Component, Input } from '@angular/core';

export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

export type DbxContentContainerWidth = 'small' | 'medium' | 'wide' | 'full';

/**
 * DbxContentContainer type.
 * 
 * Two values:
 * - normal: Full/unrestricted height content.
 * - content: Content that has a header above it and should take up the rest of the height of the page.
 */
export type DbxContentContainerType = 'normal' | 'content';

/**
 * Component that limits the max-width of the content.
 */
@Component({
  selector: 'dbx-content-container',
  template: `
    <div class="dbx-content-container" [ngClass]="width + '-container ' + type + '-container-type container-padding-' + padding + ((scrollingContent) ? ' container-scrolling-content' : '')">
      <ng-content></ng-content>
    </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbxContentContainerComponent {

  @Input()
  type = 'normal';

  @Input()
  width = 'wide';

  @Input()
  padding = 'normal';

  @Input()
  scrollingContent = false;

}
