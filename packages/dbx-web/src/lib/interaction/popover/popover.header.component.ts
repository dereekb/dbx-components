import { Component, Input, Optional } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Component used to format a header for a popover.
 */
@Component({
  selector: 'dbx-popover-header',
  template: `
  <div class="dbx-popover-header">
    <div class="dbx-popover-header-content">
      <h3><mat-icon *ngIf="icon" class="dbx-icon-spacing">{{ icon }}</mat-icon> {{ header }}</h3>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
  </div>
  <mat-divider></mat-divider>
  `,
  // TODO: styleUrls: ['./popover.scss']
})
export class DbxPopoverHeaderComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

  constructor(@Optional() appPopoverContentComponent: DbxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasHeader = true;
    }
  }

}
