import { Component, computed, input, output } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';

/**
 * Configuration for the dialog content footer button appearance.
 */
export interface DbxDialogContentFooterConfig {
  /**
   * (Optional) Material theme palette for the close button.
   *
   * Only accepts a {@link ThemePalette}; prefer {@link buttonStyle} to paint the button with an arbitrary
   * {@link DbxColorInput} (including a registered color template).
   */
  readonly buttonColor?: ThemePalette;
  readonly closeText?: string;
  /**
   * (Optional) Style for the close button.
   *
   * Defaults to {@link DEFAULT_DIALOG_CONTENT_FOOTER_BUTTON_STYLE}. A `color` set here wins over {@link buttonColor}.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
}

/**
 * Default style for the dialog content footer's close button.
 */
export const DEFAULT_DIALOG_CONTENT_FOOTER_BUTTON_STYLE: DbxButtonStyle = { type: 'raised' };

/**
 * Renders a close button at the bottom of a dialog with customizable text and color.
 *
 * @example
 * ```html
 * <dbx-dialog-content-footer [closeText]="'Done'" [buttonColor]="'primary'" (close)="onClose()"></dbx-dialog-content-footer>
 * ```
 *
 * @example
 * ```html
 * <dbx-dialog-content-footer [closeText]="'Done'" [buttonStyle]="{ type: 'flat', color: brandColor }" (close)="onClose()"></dbx-dialog-content-footer>
 * ```
 */
@Component({
  selector: 'dbx-dialog-content-footer',
  template: `
    <dbx-button [buttonStyle]="buttonStyleSignal()" [text]="closeTextSignal()" (buttonClick)="closeClicked()"></dbx-button>
  `,
  host: {
    class: 'dbx-dialog-content-footer'
  },
  imports: [DbxButtonComponent]
})
export class DbxDialogContentFooterComponent {
  readonly config = input<Maybe<DbxDialogContentFooterConfig>>();

  readonly closeText = input<Maybe<string>>();
  readonly buttonColor = input<Maybe<ThemePalette>>();
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();

  readonly closeTextSignal = computed(() => {
    const config = this.config();
    return this.closeText() ?? config?.closeText ?? 'Close';
  });

  /**
   * Resolved close button style. The narrower {@link buttonColor} is folded in as the color only when the resolved
   * style does not already carry one, so a `buttonStyle` color always wins.
   */
  readonly buttonStyleSignal = computed<DbxButtonStyle>(() => {
    const buttonColor = this.buttonColor();
    const config = this.config();
    const style = this.buttonStyle() ?? config?.buttonStyle;
    const color = style?.color ?? buttonColor ?? config?.buttonColor;
    return { ...DEFAULT_DIALOG_CONTENT_FOOTER_BUTTON_STYLE, ...style, color };
  });

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  closeClicked() {
    this.close.emit();
  }
}
