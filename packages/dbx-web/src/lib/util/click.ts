import { DestroyRef, effect, type ElementRef, inject, type Signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';

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
 * This effect exists to solve the issue of an injected element that utilizes event.stopPropogation() and doesn't also call event.preventDefault().
 *
 * We didn't want to use css's pointer-events: none as that would disable the Angular Material button effects.
 *
 * For example, dbx-button would call event.stopPropagation() on click, which would prevent the uiSref from being triggered, but the default behavior
 * of the anchor element would still be triggered, causing the browser to load/reload the page at the given href instead of navigating to the new state using uiSref.
 *
 * NOTE: Those nested event listeners are still ultimately triggered.
 *
 * Must be run in an Angular injection context.
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

    if (childClickElement) {
      if (!anchorDisabled) {
        const clickOverride = (event: MouseEvent) => {
          // Allow ctrl+click, cmd+click, shift+click, and middle-click for new tab/window
          // Don't preventDefault or stopPropagation - let browser handle it naturally
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) {
            return; // Browser will open in new tab/window
          } else {
            // otherwise, also trigger a click on the uiSref anchor element
            clickTargetElement?.nativeElement.click();
            // Prevents the default behavior of the anchor element's href from being triggered
            event.preventDefault();
            event.stopPropagation();
          }
        };

        _cleanupClickOverride = () => {
          childClickElement.nativeElement.removeEventListener('click', clickOverride);
          _cleanupClickOverride = null;
        };

        childClickElement.nativeElement.addEventListener('click', clickOverride, {
          capture: true // Use capture to ensure this event listener is called before any nested child's event listeners
        });
      }
    }
  });
}
