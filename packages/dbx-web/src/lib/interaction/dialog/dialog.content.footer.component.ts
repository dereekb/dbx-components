import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ThemePalette } from '@angular/material/core';
import { type Maybe } from '@dereekb/util';

export interface DbxDialogContentFooterConfig {
  readonly buttonColor?: ThemePalette;
  readonly closeText?: string;
}

/**
 * Component used to show a close button at the bottom of a dialog.
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

  readonly close = output<void>();

  closeClicked() {
    this.close.emit();
  }
}
