import { Clipboard } from '@angular/cdk/clipboard';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { addMilliseconds, type Configurable, type GetterOrValueWithInput, getValueFromGetter, isPast, type Maybe, type Milliseconds, MS_IN_SECOND, type Seconds } from '@dereekb/util';

/**
 * Whether copying to the clipboard succeeded.
 */
export type CopyToClipboardSuccess = boolean;

/**
 * Content that can be copied to the clipboard (strings only).
 */
export type CopyToClipboardContent = string;

/**
 * Function that copies text content to the clipboard with retry support.
 *
 * @example
 * ```ts
 * const copy = copyToClipboardFunction(clipboard);
 * const success = await copy('Hello world');
 * ```
 */
export type CopyToClipboardFunction = ((content: CopyToClipboardContent) => Promise<CopyToClipboardSuccess>) & {
  readonly _clipboard: Clipboard;
};

/**
 * Configuration for {@link copyToClipboardFunction} controlling timeout and retry behavior.
 */
export interface CopyToClipboardFunctionConfig {
  readonly copyTimeoutSeconds?: Maybe<Seconds>;
  readonly delayBetweenCopyAttempts?: Maybe<Milliseconds>;
  readonly onCopyResult?: Maybe<(success: CopyToClipboardSuccess, content: CopyToClipboardContent) => void>;
}

/**
 * Creates a {@link CopyToClipboardFunction} that retries the copy operation until success or timeout.
 *
 * @param clipboard - the Angular CDK Clipboard instance
 * @param config - optional timeout and retry settings
 * @returns a function that copies text to the clipboard
 *
 * @example
 * ```ts
 * const copy = copyToClipboardFunction(clipboard, { copyTimeoutSeconds: 10 });
 * const success = await copy('some text');
 * ```
 */
export function copyToClipboardFunction(clipboard: Clipboard, config?: CopyToClipboardFunctionConfig): CopyToClipboardFunction {
  const copyTimeoutSeconds = config?.copyTimeoutSeconds ?? 15;
  const delayBetweenCopyAttempts = config?.delayBetweenCopyAttempts ?? MS_IN_SECOND;
  const onCopyResult = config?.onCopyResult;

  const copyFunction = ((content: CopyToClipboardContent) => {
    return new Promise<CopyToClipboardSuccess>((resolve, reject) => {
      const pending = clipboard.beginCopy(content);

      const copyTimeoutAt = addMilliseconds(new Date(), copyTimeoutSeconds * MS_IN_SECOND);

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
 * Injects a {@link CopyToClipboardFunction} using Angular's dependency injection.
 *
 * Must be called in an Angular injection context.
 *
 * @param config - optional timeout and retry settings
 * @returns the clipboard copy function
 *
 * @example
 * ```ts
 * const copy = injectCopyToClipboardFunction();
 * await copy('copied text');
 * ```
 */
export function injectCopyToClipboardFunction(config?: CopyToClipboardFunctionConfig) {
  return copyToClipboardFunction(inject(Clipboard), config);
}

// MARK: Snackbar Message On Copy
/**
 * Extended clipboard copy function that shows a Material snackbar notification on success or failure.
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

/**
 * Combined configuration for the clipboard copy function and its snackbar notification behavior.
 */
export interface CopyToClipboardFunctionWithSnackbarMessageConfig extends CopyToClipboardFunctionConfig, CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig {}

/**
 * Injects a {@link CopyToClipboardFunctionWithSnackbarMessage} that copies text to the clipboard
 * and shows a Material snackbar with a success or failure message.
 *
 * Must be called in an Angular injection context.
 *
 * @param config - optional configuration for copy behavior and snackbar messages
 * @returns clipboard copy function with snackbar notification support
 *
 * @example
 * ```ts
 * const copy = injectCopyToClipboardFunctionWithSnackbarMessage({
 *   successMessage: 'Link copied!',
 *   snackbarDuration: 2000
 * });
 * await copy('https://example.com');
 * ```
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
