import { Component, Optional } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover Controls
 */
@Component({
  selector: 'dbx-popover-controls',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'd-block dbx-popover-controls'
  }
})
export class DbxPopoverControlsComponent {

  constructor(@Optional() appPopoverContentComponent: DbxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasControls = true;
    }
  }

}
