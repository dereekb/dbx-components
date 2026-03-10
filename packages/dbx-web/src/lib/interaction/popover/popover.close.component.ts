import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

/**
 * Renders a close icon button that closes the parent popover when clicked.
 *
 * @example
 * ```html
 * <dbx-popover-header [header]="'Settings'">
 *   <dbx-popover-close-button></dbx-popover-close-button>
 * </dbx-popover-header>
 * ```
 */
@Component({
  selector: 'dbx-popover-close-button',
  template: `
    <button mat-icon-button (click)="dbxPopoverComponent.close()"><mat-icon>close</mat-icon></button>
  `,
  imports: [MatIconModule, MatIconButton],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverCloseButtonComponent {
  readonly dbxPopoverComponent = inject(DbxPopoverComponent);
}
