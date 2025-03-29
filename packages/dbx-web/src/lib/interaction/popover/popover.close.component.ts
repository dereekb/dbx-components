import { Component, inject } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

/**
 * Pre-configured close icon button for use within popover header.
 */
@Component({
  selector: 'dbx-popover-close-button',
  template: `
    <button mat-icon-button (click)="dbxPopoverComponent.close()"><mat-icon>close</mat-icon></button>
  `,
  imports: [MatIcon, MatIconButton],
  standalone: true
})
export class DbxPopoverCloseButtonComponent {
  readonly dbxPopoverComponent = inject(DbxPopoverComponent);
}
