import { Component, Input } from '@angular/core';

export enum DbxContentContainerPadding {
  NONE = 'none',
  MIN = 'min',
  SMALL = 'small',
  NORMAL = 'normal'
}

export enum DbxContentContainerWidth {
  SMALL = 'small',
  MEDIUM = 'medium',
  WIDE = 'wide',
  FULL = 'full'
}

export enum DbxContentContainerType {
  /**
   * Full/unrestricted height content.
   */
  NORMAL = 'normal',
  /**
   * Content that has a header above it and should take up the rest of the height of the page.
   */
  CONTENT = 'content'
}

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
  type = DbxContentContainerType.NORMAL;

  @Input()
  width = DbxContentContainerWidth.WIDE;

  @Input()
  padding = DbxContentContainerPadding.NORMAL;

  @Input()
  scrollingContent = false;

}
