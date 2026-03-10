import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { type ResizedEvent } from '../../screen/resize';
import { DbxResizedDirective } from '../../screen/resize.directive';

/**
 * A two-section layout block where the top section has a measured height and the bottom
 * section fills the remaining vertical space.
 *
 * The top section's height is dynamically measured via resize observation. Use the `[top]`
 * content slot for the fixed-height area and default content for the flexible bottom area.
 *
 * @example
 * ```html
 * <dbx-two-block [fixedTop]="true">
 *   <div top>Fixed header area</div>
 *   <div>Scrollable content area</div>
 * </dbx-two-block>
 * ```
 */
@Component({
  selector: 'dbx-two-block',
  template: `
    <div #two class="dbx-two-block-content" [ngStyle]="{ '--dbx-two-block-top-height': topHeightPixelsSignal() }">
      <div #top class="dbx-two-block-top" (dbxResized)="viewResized($event)">
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
  imports: [DbxResizedDirective, NgStyle],
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
