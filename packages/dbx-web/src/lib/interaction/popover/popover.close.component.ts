import { Component } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';

/**
 * Pre-configured close icon button for use within popover header.
 */
@Component({
  selector: 'dbx-popover-close-button',
  template: `
    <button mat-icon-button (click)="dbxPopoverComponent.close()"><mat-icon>close</mat-icon></button>
  `
})
export class DbxPopoverCloseButtonComponent {
  constructor(readonly dbxPopoverComponent: DbxPopoverComponent) {}
}
