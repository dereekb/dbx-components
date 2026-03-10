import { Directive, inject, type OnInit } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Marks an element as the controls section within a popover content container.
 *
 * Can be used as an element, attribute, or CSS class selector. Notifies the parent {@link DbxPopoverContentComponent} that controls are present.
 *
 * @example
 * ```html
 * <dbx-popover-content>
 *   <dbx-popover-controls>
 *     <dbx-popover-header [header]="'Title'"></dbx-popover-header>
 *   </dbx-popover-controls>
 *   <p>Body content.</p>
 * </dbx-popover-content>
 * ```
 */
@Directive({
  selector: 'dbx-popover-controls,[dbxPopoverControls],.dbx-popover-controls',
  host: {
    class: 'd-block dbx-popover-controls'
  },
  standalone: true
})
export class DbxPopoverControlsDirective implements OnInit {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent, { optional: true });

  ngOnInit() {
    if (this.appPopoverContentComponent) {
      this.appPopoverContentComponent.hasControls.next(true);
    }
  }
}
