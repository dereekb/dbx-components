import { Directive, effect, ElementRef, HostListener, inject, input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig, injectCopyToClipboardFunctionWithSnackbarMessage } from './clipboard';

@Directive()
export class AbstractDbxClipboardDirective {
  protected readonly _copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();

  readonly clipboardSnackbarMessagesConfig = input<Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>>(undefined);
  readonly clipboardSnackbarMessagesEnabled = input<boolean>(true);

  protected readonly _configEffect = effect(() => {
    this._copyToClipboard.setSnackbarMessagesConfig(this.clipboardSnackbarMessagesConfig());
  });

  protected readonly _enabledEffect = effect(() => {
    this._copyToClipboard.setSnackbarMessagesEnabled(this.clipboardSnackbarMessagesEnabled());
  });
}
