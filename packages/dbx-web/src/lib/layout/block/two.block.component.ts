import { ElementRef, Component, ViewChild, Input } from '@angular/core';
import { ResizedEvent } from 'angular-resize-event-package';

/**
 * Wrapper of a block that is broken into two parts, with the bottom content's height
 * being set to 100% of the height minus the top's height.
 *
 * The block is made up of two divs, a top and a bottom. The top is assigned a static height, and the bottom is given the remainder.
 * The height is calculated from 100%.
 */
@Component({
  selector: 'dbx-two-block',
  template: `
    <div #two class="dbx-two-block-content">
      <div #top class="dbx-two-block-top" (resized)="onResized($event)">
        <ng-content select="[top]"></ng-content>
      </div>
      <div #bottom class="dbx-two-block-bottom">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  host: {
    class: 'dbx-two-block d-block',
    '[class]': '{ "dbx-two-block-fixed-top": fixedTop }'
  }
})
export class DbxTwoBlocksComponent {
  /**
   * Whether or not the top bar should be fixed in place instead of scrolling with the bottom when content is too tall.
   */
  @Input()
  fixedTop = true;

  @ViewChild('two', { read: ElementRef, static: true })
  twoElement!: ElementRef;

  /*
  @ViewChild('top', { read: ElementRef, static: true })
  topElement!: ElementRef;

  @ViewChild('bottom', { read: ElementRef, static: true })
  bottomElement!: ElementRef;
  */

  onResized(event: ResizedEvent): void {
    const height = event.newRect.height;
    const element: HTMLElement = this.twoElement.nativeElement;
    element.style.setProperty('--dbx-two-block-top-height', `${height}px`);
  }
}
