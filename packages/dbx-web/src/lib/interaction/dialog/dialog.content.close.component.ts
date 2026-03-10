import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Renders a floating close button positioned in the corner of a dialog.
 *
 * @example
 * ```html
 * <dbx-dialog-content-close (close)="onClose()" [padded]="true"></dbx-dialog-content-close>
 * ```
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
  imports: [MatIconModule, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDialogContentCloseComponent {
  readonly padded = input<boolean>(true);

  readonly close = output<void>();

  closeClicked() {
    this.close.emit(undefined);
  }
}
