import { Directive, inject } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover Controls
 */
@Directive({
  selector: 'dbx-popover-controls,[dbxPopoverControls],.dbx-popover-controls',
  host: {
    class: 'd-block dbx-popover-controls'
  }
})
export class DbxPopoverControlsDirective {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent, { optional: true });

  ngOnInit() {
    if (this.appPopoverContentComponent) {
      this.appPopoverContentComponent.hasControls = true;
    }
  }
}
