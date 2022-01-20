import { Component, Input, Optional } from '@angular/core';
import { DbNgxPopoverContentComponent } from './popover.content.component';

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
  styleUrls: ['./popover.scss']
})
export class DbNgxPopoverHeaderComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

  constructor(@Optional() appPopoverContentComponent: DbNgxPopoverContentComponent) {
    if (appPopoverContentComponent) {
      appPopoverContentComponent.hasHeader = true;
    }
  }

}
