import { Component, ComponentFactoryResolver, Inject, Input, NgZone, Type, ViewChild, ViewContainerRef, OnInit, OnDestroy, ComponentRef, Optional } from '@angular/core';
import { DbNgxPopoverContentComponent } from './popover.content.component';

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
  styleUrls: ['./popover.scss']
})
export class DbNgxPopoverControlsComponent {

  constructor(@Optional() appPopoverContentComponent: DbNgxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasControls = true;
    }
  }

}
