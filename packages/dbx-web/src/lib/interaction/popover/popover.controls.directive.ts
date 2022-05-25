import { Directive, Optional } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover Controls
 */
@Directive({
  selector: 'dbx-popover-controls,[dbxPopoverControls],.dbx-popover-controls',
  host: {
    'class': 'd-block dbx-popover-controls'
  }
})
export class DbxPopoverControlsDirective {

  constructor(@Optional() appPopoverContentComponent: DbxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasControls = true;
    }
  }

}
