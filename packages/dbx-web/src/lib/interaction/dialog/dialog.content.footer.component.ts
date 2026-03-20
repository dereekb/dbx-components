import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { type ThemePalette } from '@angular/material/core';
import { type Maybe } from '@dereekb/util';

/**
 * Configuration for the dialog content footer button appearance.
 */
export interface DbxDialogContentFooterConfig {
  readonly buttonColor?: ThemePalette;
  readonly closeText?: string;
}

/**
 * Renders a close button at the bottom of a dialog with customizable text and color.
 *
 * @example
 * ```html
 * <dbx-dialog-content-footer [closeText]="'Done'" [buttonColor]="'primary'" (close)="onClose()"></dbx-dialog-content-footer>
 * ```
 */
@Component({
  selector: 'dbx-dialog-content-footer',
  template: `
    <button mat-raised-button [color]="buttonColorSignal()" (click)="closeClicked()">{{ closeTextSignal() }}</button>
  `,
  host: {
    class: 'dbx-dialog-content-footer'
  },
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDialogContentFooterComponent {
  readonly config = input<Maybe<DbxDialogContentFooterConfig>>();

  readonly closeText = input<Maybe<string>>();
  readonly buttonColor = input<Maybe<ThemePalette>>();

  readonly closeTextSignal = computed(() => this.closeText() ?? this.config()?.closeText ?? 'Close');
  readonly buttonColorSignal = computed(() => this.buttonColor() ?? this.config()?.buttonColor ?? undefined);

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  closeClicked() {
    this.close.emit();
  }
}
