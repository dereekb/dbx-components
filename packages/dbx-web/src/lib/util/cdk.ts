import { type DestroyFunction } from '@dereekb/util';

/**
 * Disables the "contextmenu" from popping up in the cdk-overlay-container.
 *
 * @param classes
 * @param onEvent
 * @returns
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
    return () => {};
  }
}
