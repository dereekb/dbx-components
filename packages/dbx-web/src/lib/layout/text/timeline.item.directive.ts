import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';

/**
 * Directive form of a `.dbx-timeline` step — applies the `dbx-timeline-item` class to its host, and opens a
 * scrolling timeline on the step in progress.
 *
 * A `.dbx-timeline` keeps its steps at a readable minimum width, so on a narrow viewport the row scrolls sideways.
 * Left at its start, a timeline with several finished steps would only show those, and read as complete. Mark the
 * step in progress with `[dbxTimelineItemCurrent]` and the timeline scrolls to center it — the last finished step
 * stays in view on one side and the next step on the other. It re-centers whenever the timeline is laid out at a new
 * width (its first layout, a timeline first shown in a hidden tab, a window resize), never in response to the user's
 * own scrolling, and does nothing while the steps fit.
 *
 * The current step also takes the `dbx-timeline-item-current` class.
 *
 * @dbxWebComponent
 * @dbxWebSlug timeline-item
 * @dbxWebCategory layout
 * @dbxWebRelated icon-tile, avatar, dbx-color, step-block
 * @dbxWebMinimalExample ```html
 * <div class="dbx-timeline">
 *   <div dbxTimelineItem>...</div>
 *   <div dbxTimelineItem [dbxTimelineItemCurrent]="true" dbxColor="primary">...</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <div class="dbx-timeline">
 *   @for (step of steps; track step.label) {
 *     <div dbxTimelineItem [dbxTimelineItemCurrent]="step.state === 'current'" [dbxColor]="step.connectorColor">
 *       <dbx-icon-tile [icon]="step.icon" [dbxColor]="step.markerColor" [round]="true"></dbx-icon-tile>
 *       <span class="dbx-text-label-large">{{ step.label }}</span>
 *     </div>
 *   }
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxTimelineItem]',
  host: {
    class: 'dbx-timeline-item',
    '[class.dbx-timeline-item-current]': 'dbxTimelineItemCurrent()'
  }
})
export class DbxTimelineItemDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Whether this is the step in progress, which a scrolling timeline centers.
   */
  readonly dbxTimelineItemCurrent = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  constructor() {
    // Watches the timeline's size rather than scrolling once: a ResizeObserver reports the first layout, and a
    // timeline rendered at zero width (an inactive tab) reports again once it is shown. Scrolling never changes the
    // observed size, so the user's own scrolling is left alone.
    afterRenderEffect((onCleanup) => {
      const item = this._elementRef.nativeElement;
      const timeline = item.parentElement;

      if (this.dbxTimelineItemCurrent() && timeline) {
        const observer = new ResizeObserver(() => {
          const timelineRect = timeline.getBoundingClientRect();
          const itemRect = item.getBoundingClientRect();
          timeline.scrollBy({ left: itemRect.left + itemRect.width / 2 - (timelineRect.left + timelineRect.width / 2) });
        });

        observer.observe(timeline);
        onCleanup(() => observer.disconnect());
      }
    });
  }
}
