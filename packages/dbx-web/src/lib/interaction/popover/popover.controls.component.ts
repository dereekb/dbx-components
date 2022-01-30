import { Component, Optional } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover Controls
 */
@Component({
  selector: 'dbx-popover-controls',
  template: `
  <div class="dbx-popover-controls">
    <ng-content></ng-content>
  </div>
  `,
  // TODO: styleUrls: ['./popover.scss']
})
export class DbxPopoverControlsComponent {

  constructor(@Optional() appPopoverContentComponent: DbxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasControls = true;
    }
  }

}
