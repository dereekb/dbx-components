import { Component, type ElementRef, input, viewChild } from '@angular/core';
import { DbxClickToCopyTextDirective } from './copy.text.directive';
import { type Maybe } from '@dereekb/util';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util';
import { MatIcon } from '@angular/material/icon';

/**
 * Wraps projected content with click-to-copy functionality and a copy icon button.
 *
 * Clicking the text or the icon copies the text to the clipboard and optionally shows a snackbar confirmation.
 *
 * @example
 * ```html
 * <dbx-click-to-copy-text copyText="some-value">some-value</dbx-click-to-copy-text>
 * <dbx-click-to-copy-text [clickIconToCopyOnly]="true">Click icon only</dbx-click-to-copy-text>
 * ```
 */
@Component({
  selector: 'dbx-click-to-copy-text',
  template: `
    <span #content [dbxClickToCopyText]="copyText()" [disableCopy]="clickIconToCopyOnly()" [highlighted]="highlighted()" [clipboardSnackbarMessagesEnabled]="clipboardSnackbarMessagesEnabled()" [clipboardSnackbarMessagesConfig]="clipboardSnackbarMessagesConfig()" [copyTextFromElement]="contentElementRef()">
      <ng-content></ng-content>
    </span>
    @if (showIcon()) {
      <mat-icon class="dbx-click-to-copy-text-icon" (click)="dbxClickToCopyText()?._copyText()">{{ clickToCopyIcon() }}</mat-icon>
    }
  `,
  host: {
    class: 'dbx-click-to-copy-text-component'
  },
  imports: [DbxClickToCopyTextDirective, MatIcon],
  standalone: true
})
export class DbxClickToCopyTextComponent {
  readonly contentElementRef = viewChild<ElementRef<HTMLElement>>('content');
  readonly dbxClickToCopyText = viewChild<DbxClickToCopyTextDirective>(DbxClickToCopyTextDirective);

  readonly copyText = input<Maybe<string | null>>(undefined);
  readonly showIcon = input<Maybe<boolean>>(true);
  readonly highlighted = input<boolean>(false);
  readonly clipboardSnackbarMessagesConfig = input<Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>>(undefined);
  readonly clipboardSnackbarMessagesEnabled = input<boolean>(true);
  readonly clickToCopyIcon = input<string>('content_copy');
  readonly clickIconToCopyOnly = input<boolean>(false);
}
