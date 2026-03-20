import { type DestroyFunction } from '@dereekb/util';

/**
 * Disables the browser right-click context menu on the CDK overlay container element.
 *
 * Useful for preventing the default context menu from appearing over dialogs or popups.
 *
 * @param classes - CSS class name of the overlay container element to target. Defaults to `'cdk-overlay-container'`.
 * @param onEvent - optional callback invoked on each suppressed right-click event
 * @returns a cleanup function that removes the event listener
 *
 * @example
 * ```ts
 * const cleanup = disableRightClickInCdkBackdrop();
 * // later, to re-enable:
 * cleanup();
 * ```
 */
export function disableRightClickInCdkBackdrop(classes: string = 'cdk-overlay-container', onEvent?: (event: MouseEvent) => void): DestroyFunction {
  const eventListener = function (this: Element, event: Event) {
    event.preventDefault();
    onEvent?.(event as MouseEvent);
  };

  const target = document.getElementsByClassName(classes).item(0);

  if (target) {
    target.addEventListener('contextmenu', eventListener);
    return () => target.removeEventListener('contextmenu', eventListener);
  } else {
    return () => {
      /* noop */
    };
  }
}
