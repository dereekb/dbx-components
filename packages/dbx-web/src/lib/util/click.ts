import { DestroyRef, effect, type ElementRef, inject, type Signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';

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
 * Modifier clicks (ctrl, cmd, shift, middle-click) are allowed through for new tab/window behavior.
 *
 * Must be called in an Angular injection context.
 *
 * @example
 * ```ts
 * overrideClickElementEffect({
 *   clickTarget: this.anchorElementRef,
 *   childClickTarget: this.buttonElementRef
 * });
 * ```
 *
 * @param config - configuration specifying the click target, child element to intercept, and optional disabled signal
 * @returns the created Angular effect reference
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
