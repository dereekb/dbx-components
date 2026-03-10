import { Directive, effect, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig, injectCopyToClipboardFunctionWithSnackbarMessage } from './clipboard';

/**
 * Abstract base class for clipboard directives that provides copy-to-clipboard
 * functionality with configurable snackbar notifications.
 *
 * Subclasses should call `this._copyToClipboard(text)` to trigger a copy operation.
 */
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
