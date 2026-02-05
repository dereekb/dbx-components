import { Clipboard } from '@angular/cdk/clipboard';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { addMilliseconds, Configurable, GetterOrValueWithInput, getValueFromGetter, isPast, Maybe, Milliseconds, MS_IN_SECOND, Seconds } from '@dereekb/util';

/**
 * True if copying to the clipboard was successful.
 */
export type CopyToClipboardSuccess = boolean;

/**
 * Can only copy strings to the clipboard.
 */
export type CopyToClipboardContent = string;

/**
 * Copies the input text to the clipboard.
 *
 * @param content The content to copy.
 * @returns A promise that resolves to true if the content was copied successfully, false otherwise.
 */
export type CopyToClipboardFunction = ((content: CopyToClipboardContent) => Promise<CopyToClipboardSuccess>) & {
  readonly _clipboard: Clipboard;
};

export interface CopyToClipboardFunctionConfig {
  readonly copyTimeoutSeconds?: Maybe<Seconds>;
  readonly delayBetweenCopyAttempts?: Maybe<Milliseconds>;
  readonly onCopyResult?: Maybe<(success: CopyToClipboardSuccess, content: CopyToClipboardContent) => void>;
}

/**
 * Creates a copy to clipboard function.
 *
 * @param clipboard The clipboard to use.
 * @param config Optional configuration.
 * @returns The copy to clipboard function.
 */
export function copyToClipboardFunction(clipboard: Clipboard, config?: CopyToClipboardFunctionConfig): CopyToClipboardFunction {
  const copyTimeoutSeconds = config?.copyTimeoutSeconds ?? 15;
  const delayBetweenCopyAttempts = config?.delayBetweenCopyAttempts ?? MS_IN_SECOND;
  const onCopyResult = config?.onCopyResult;

  const copyFunction = ((content: CopyToClipboardContent) => {
    return new Promise<CopyToClipboardSuccess>((resolve, reject) => {
      const pending = clipboard.beginCopy(content);

      let copyTimeoutAt = addMilliseconds(new Date(), copyTimeoutSeconds * MS_IN_SECOND);

      const attempt = () => {
        const copyIsFinished = pending.copy();

        if (!copyIsFinished && !isPast(copyTimeoutAt)) {
          setTimeout(attempt, delayBetweenCopyAttempts);
        } else {
          // Destroy the pending copy
          pending.destroy();

          if (copyIsFinished) {
            resolve(true);
            onCopyResult?.(true, content);
          } else {
            reject(false);
            onCopyResult?.(false, content);
          }
        }
      };

      attempt();
    });
  }) as unknown as CopyToClipboardFunction;
  (copyFunction as Configurable<CopyToClipboardFunction>)._clipboard = clipboard;
  return copyFunction;
}

/**
 * Injects a copy to clipboard function.
 *
 * Must be run in an Angular injection context.
 *
 * @param config
 * @returns
 */
export function injectCopyToClipboardFunction(config?: CopyToClipboardFunctionConfig) {
  return copyToClipboardFunction(inject(Clipboard), config);
}

// MARK: Snackbar Message On Copy
/**
 * Copies the input text to the clipboard.
 *
 * @param content The content to copy.
 * @returns A promise that resolves to true if the content was copied successfully, false otherwise.
 */
export type CopyToClipboardFunctionWithSnackbarMessage = CopyToClipboardFunction & {
  setSnackbarMessagesConfig(config: Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>): void;
  setSnackbarMessagesEnabled(enabled: boolean): void;
};

export interface CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig {
  /**
   * The duration to show the snackbar for.
   *
   * Defaults to 3 seconds.
   */
  readonly snackbarDuration?: Milliseconds;
  /**
   * The message to show when the content is copied successfully.
   */
  readonly successMessage?: GetterOrValueWithInput<string, CopyToClipboardContent>;
  /**
   * The message to show when the content fails to copy.
   */
  readonly failureMessage?: GetterOrValueWithInput<string, CopyToClipboardContent>;
}

export interface CopyToClipboardFunctionWithSnackbarMessageConfig extends CopyToClipboardFunctionConfig, CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig {}

/**
 * Injects a copy to clipboard function.
 *
 * Must be run in an Angular injection context.
 *
 * @param config
 * @returns
 */
export function injectCopyToClipboardFunctionWithSnackbarMessage(config?: CopyToClipboardFunctionWithSnackbarMessageConfig) {
  // TODO: Add service for configuring global defaults for snackbar messages

  const snackbar = inject(MatSnackBar);

  const DEFAULT_SUCCESS_MESSAGE = 'Copied to clipboard';
  const DEFAULT_FAILURE_MESSAGE = 'Content failed to copy...';
  const DEFAULT_SNACKBAR_DURATION = 3 * MS_IN_SECOND;

  let snackbarMessagesEnabled = true;
  let successMessage: GetterOrValueWithInput<string, CopyToClipboardContent> = DEFAULT_SUCCESS_MESSAGE;
  let failureMessage: GetterOrValueWithInput<string, CopyToClipboardContent> = DEFAULT_FAILURE_MESSAGE;
  let snackbarDuration: Milliseconds = DEFAULT_SNACKBAR_DURATION;

  const _setSnackbarMessagesConfig = (config: Maybe<CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig>) => {
    if (config != null) {
      const { successMessage: inputSuccessMessage, failureMessage: inputFailureMessage, snackbarDuration: inputSnackbarDuration } = config;

      successMessage = (inputSuccessMessage !== undefined ? inputSuccessMessage : successMessage) ?? DEFAULT_SUCCESS_MESSAGE;
      failureMessage = (inputFailureMessage !== undefined ? inputFailureMessage : failureMessage) ?? DEFAULT_FAILURE_MESSAGE;
      snackbarDuration = (inputSnackbarDuration !== undefined ? inputSnackbarDuration : snackbarDuration) ?? DEFAULT_SNACKBAR_DURATION;
    }
  };

  if (config) {
    _setSnackbarMessagesConfig(config);
  }

  const onCopyResult = (success: CopyToClipboardSuccess, content: CopyToClipboardContent) => {
    config?.onCopyResult?.(success, content);

    if (snackbarMessagesEnabled) {
      const message = success ? getValueFromGetter(successMessage, content) : getValueFromGetter(failureMessage, content);
      snackbar.open(message, undefined, { duration: snackbarDuration });
    }
  };

  const result = copyToClipboardFunction(inject(Clipboard), { ...config, onCopyResult }) as CopyToClipboardFunctionWithSnackbarMessage;

  (result as Configurable<CopyToClipboardFunctionWithSnackbarMessage>).setSnackbarMessagesConfig = _setSnackbarMessagesConfig;
  (result as Configurable<CopyToClipboardFunctionWithSnackbarMessage>).setSnackbarMessagesEnabled = (enabled: boolean) => {
    snackbarMessagesEnabled = enabled;
  };

  return result;
}
