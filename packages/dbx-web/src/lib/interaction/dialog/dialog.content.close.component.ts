import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * Component used to show a close button at the top of a dialog, floating in a corner.
 */
@Component({
  selector: 'dbx-dialog-content-close',
  template: `
    <button class="dbx-dialog-content-close-button" mat-icon-button (click)="closeClicked()">
      <mat-icon>close</mat-icon>
    </button>
  `,
  host: {
    class: 'dbx-dialog-content-close',
    '[class.dbx-dialog-content-close-padding]': 'padded()'
  },
  standalone: true,
  imports: [MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDialogContentCloseComponent {
  readonly padded = input<boolean>(true);
  readonly close = output<void>();

  closeClicked() {
    this.close.emit(undefined);
  }
}
