import { DestroyRef, effect, type ElementRef, inject, type Signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * CSS class that opts a region inside a {@link overrideClickElementEffect} child target out of the override.
 *
 * Clicks from inside an element with this class are not redirected to the click target, and are neither prevented nor
 * stopped, so buttons in that region run their own handlers. The region is responsible for stopping propagation itself
 * when the click should not reach the parent (for example, a gallery tile's action bar inside a clickable list anchor).
 */
export const DBX_OVERRIDE_CLICK_IGNORE_CLASS = 'dbx-override-click-ignore';

/**
 * Whether the click event came from inside a {@link DBX_OVERRIDE_CLICK_IGNORE_CLASS} region within the child target.
 *
 * @param event - The click event.
 * @param childClickElement - The child target the override is watching.
 * @returns True when the override should leave the event alone.
 */
export function isOverrideClickIgnoredEvent(event: Event, childClickElement: HTMLElement): boolean {
  const ignoredRegion = (event.target as Maybe<Element>)?.closest?.(`.${DBX_OVERRIDE_CLICK_IGNORE_CLASS}`);
  return ignoredRegion != null && ignoredRegion !== childClickElement && childClickElement.contains(ignoredRegion);
}

/**
 * Configuration for {@link overrideClickElementEffect} specifying the click target
 * and the child element whose clicks should be intercepted.
 */
export interface OverrideClickElementEffectConfig {
  /**
   * Target to transfer "click" events to.
   */
  readonly clickTarget?: Maybe<Signal<Maybe<ElementRef<HTMLElement>>>>;
  /**
   * The child target to watch and override clicks for.
   */
  readonly childClickTarget: Signal<Maybe<ElementRef<HTMLElement>>>;
  /**
   * Optional signal to disable the clicking override.
   */
  readonly disabledSignal?: Maybe<Signal<boolean>>;
}

/**
 * Creates an Angular effect that intercepts clicks on a child element and redirects them
 * to a parent click target, while preventing the default browser navigation.
 *
 * Solves the problem where an injected element calls `event.stopPropagation()` without
 * `event.preventDefault()` — for example, a `dbx-button` inside a router anchor would
 * stop the router link from firing but still trigger the anchor's href navigation.
 *
 * Modifier clicks (ctrl, cmd, shift, middle-click) are allowed through for new tab/window behavior. Clicks from inside a
 * {@link DBX_OVERRIDE_CLICK_IGNORE_CLASS} region of the child target are also left alone.
 *
 * Must be called in an Angular injection context.
 *
 * @param config - Configuration specifying the click target, child element to intercept, and optional disabled signal.
 * @returns The created Angular effect reference.
 *
 * @example
 * ```ts
 * overrideClickElementEffect({
 *   clickTarget: this.anchorElementRef,
 *   childClickTarget: this.buttonElementRef
 * });
 * ```
 */
export function overrideClickElementEffect(config: OverrideClickElementEffectConfig) {
  const { clickTarget, childClickTarget, disabledSignal } = config;

  const destroyRef = inject(DestroyRef);

  let _cleanupClickOverride: Maybe<() => void>;

  destroyRef.onDestroy(() => {
    _cleanupClickOverride?.();
  });

  return effect(() => {
    const clickTargetElement = clickTarget?.();
    const childClickElement = childClickTarget();
    const anchorDisabled = disabledSignal?.() ?? false;

    // cleanup/remove the previous/existing click function
    if (_cleanupClickOverride) {
      _cleanupClickOverride();
    }

    if (childClickElement && !anchorDisabled) {
      const clickOverride = (event: MouseEvent) => {
        // Allow ctrl+click, cmd+click, shift+click, and middle-click for new tab/window
        // Don't preventDefault or stopPropagation - let browser handle it naturally
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) {
          return; // Browser will open in new tab/window
        }

        // Leave clicks from opted-out regions to their own handlers
        if (isOverrideClickIgnoredEvent(event, childClickElement.nativeElement)) {
          return;
        }

        // otherwise, also trigger a click on the uiSref anchor element
        clickTargetElement?.nativeElement.click();
        // Prevents the default behavior of the anchor element's href from being triggered
        event.preventDefault();
        event.stopPropagation();
      };

      _cleanupClickOverride = () => {
        childClickElement.nativeElement.removeEventListener('click', clickOverride);
        _cleanupClickOverride = null;
      };

      childClickElement.nativeElement.addEventListener('click', clickOverride, {
        capture: true // Use capture to ensure this event listener is called before any nested child's event listeners
      });
    }
  });
}
