import { Component, Input, OnInit, inject } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Component used to format a header for a popover.
 */
@Component({
  selector: 'dbx-popover-header',
  template: `
    <div class="dbx-popover-header">
      <div class="dbx-popover-header-content">
        <h3>
          <mat-icon *ngIf="icon" class="dbx-icon-spacer">{{ icon }}</mat-icon>
          {{ header }}
        </h3>
        <span class="spacer"></span>
        <ng-content></ng-content>
      </div>
    </div>
    <mat-divider></mat-divider>
  `
})
export class DbxPopoverHeaderComponent implements OnInit {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent, { optional: true });

  @Input()
  header?: string;

  @Input()
  icon?: string;

  ngOnInit() {
    if (this.appPopoverContentComponent) {
      this.appPopoverContentComponent.hasHeader = true;
    }
  }
}
