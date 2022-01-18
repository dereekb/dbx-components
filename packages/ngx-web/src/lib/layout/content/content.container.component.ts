import { Component, Input } from '@angular/core';

export enum DbNgxContentContainerPadding {
  NONE = 'none',
  MIN = 'min',
  SMALL = 'small',
  NORMAL = 'normal'
}

export enum DbNgxContentContainerWidth {
  SMALL = 'small',
  MEDIUM = 'medium',
  WIDE = 'wide',
  FULL = 'full'
}

export enum DbNgxContentContainerType {
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
  styleUrls: ['./container.scss']
})
export class DbNgxContentContainerComponent {

  @Input()
  type = DbNgxContentContainerType.NORMAL;

  @Input()
  width = DbNgxContentContainerWidth.WIDE;

  @Input()
  padding = DbNgxContentContainerPadding.NORMAL;

  @Input()
  scrollingContent = false;

}
