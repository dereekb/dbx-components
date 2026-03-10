import { computed, Directive, inject } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Marks a region as scrollable content within a popover, applying dynamic CSS classes based on whether header and controls are present.
 *
 * Can be used as an element, attribute, or CSS class selector.
 *
 * @example
 * ```html
 * <dbx-popover-content>
 *   <dbx-popover-controls controls>...</dbx-popover-controls>
 *   <dbx-popover-scroll-content>
 *     <p>Scrollable content here.</p>
 *   </dbx-popover-scroll-content>
 * </dbx-popover-content>
 * ```
 */
@Directive({
  selector: 'dbx-popover-scroll-content,[dbxPopoverScrollContent],.dbx-popover-scroll-content',
  host: {
    class: 'd-block dbx-popover-scroll-content',
    '[class]': 'sizingClassesSignal()'
  },
  standalone: true
})
export class DbxPopoverScrollContentDirective {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent);

  readonly hasControlsSignal = toSignal(this.appPopoverContentComponent.hasControls);
  readonly hasHeaderSignal = toSignal(this.appPopoverContentComponent.hasHeader);

  readonly sizingClassesSignal = computed(() => {
    const hasHeader = this.hasHeaderSignal();
    const hasControls = this.hasControlsSignal();

    const classes: string[] = [];

    if (hasHeader && hasControls) {
      classes.push('popover-has-controls-and-header');
    } else if (hasHeader) {
      classes.push('popover-has-header');
    } else if (hasControls) {
      classes.push('popover-has-controls');
    }

    return classes.join(' ');
  });
}
