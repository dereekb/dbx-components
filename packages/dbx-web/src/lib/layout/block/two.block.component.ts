import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AngularResizeEventModule, ResizedEvent } from 'angular-resize-event-package';

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
    <div #two class="dbx-two-block-content" [ngStyle]="{ '--dbx-two-block-top-height': topHeightPixelsSignal() }">
      <div #top class="dbx-two-block-top" (resized)="viewResized($event)">
        <ng-content select="[top]"></ng-content>
      </div>
      <div #bottom class="dbx-two-block-bottom">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  host: {
    class: 'dbx-two-block d-block',
    '[class]': '{ "dbx-two-block-fixed-top": fixedTop() }'
  },
  imports: [AngularResizeEventModule, NgStyle],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTwoBlockComponent {
  /**
   * Whether or not the top bar should be fixed in place instead of scrolling with the bottom when content is too tall.
   */
  readonly fixedTop = input<boolean>(true);

  readonly topHeightSignal = signal<number>(0);
  readonly topHeightPixelsSignal = computed(() => `${this.topHeightSignal()}px`);

  viewResized(event: ResizedEvent): void {
    const height = event.newRect.height;
    this.topHeightSignal.set(height);
  }
}
