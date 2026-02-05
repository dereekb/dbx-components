import { Component, ElementRef, input, viewChild } from '@angular/core';
import { DbxClickToCopyTextDirective } from './copy.text.directive';
import { Maybe } from '@dereekb/util';
import { CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'dbx-click-to-copy-text',
  template: `
    <span #content [dbxClickToCopyText]="copyText()" [disableCopy]="clickIconToCopyOnly()" [highlighted]="highlighted()" [clipboardSnackbarMessagesEnabled]="clipboardSnackbarMessagesEnabled()" [clipboardSnackbarMessagesConfig]="clipboardSnackbarMessagesConfig()" [copyTextFromElement]="contentElementRef()">
      <ng-content></ng-content>
    </span>
    <mat-icon class="dbx-click-to-copy-text-icon" (click)="dbxClickToCopyText()?._copyText()">{{ clickToCopyIcon() }}</mat-icon>
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
  readonly highlighted = input<boolean>(false);
  readonly clipboardSnackbarMessagesConfig = input<Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>>(undefined);
  readonly clipboardSnackbarMessagesEnabled = input<boolean>(true);
  readonly clickToCopyIcon = input<string>('content_copy');
  readonly clickIconToCopyOnly = input<boolean>(false);
}
