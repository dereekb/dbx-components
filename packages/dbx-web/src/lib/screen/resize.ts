import { DestroyRef, ElementRef, inject, type Signal, signal } from '@angular/core';

/**
 * Resize event used by resizeSignal.
 *
 * Maintains the same pattern as https://github.com/NemesLaszlo/angular-resize-event
 */
export interface ResizedEvent {
  readonly newRect: DOMRectReadOnly;
  readonly oldRect?: DOMRectReadOnly;
  readonly isFirst: boolean;
}

/**
 * Creates a signal that emits {@link ResizedEvent} values whenever the observed element is resized.
 *
 * Must be called in an Angular injection context. Automatically disconnects the ResizeObserver on destroy.
 *
 * @param inputElement - the element to observe; if omitted, the host element is injected via `ElementRef`
 * @returns a read-only signal of resize events
 *
 * @example
 * ```ts
 * // In a component:
 * readonly resize = resizeSignal();
 *
 * readonly widthEffect = effect(() => {
 *   console.log('New width:', this.resize().newRect.width);
 * });
 * ```
 */
export function resizeSignal(inputElement?: ElementRef<HTMLElement>): Signal<ResizedEvent> {
  const element = inputElement ?? inject(ElementRef<HTMLElement>);

  const destroyRef = inject(DestroyRef);
  const resizeSignal = signal<ResizedEvent>({
    newRect: element.nativeElement.getBoundingClientRect(),
    isFirst: true
  });

  let oldRect: DOMRectReadOnly;

  const observeEvent = (entries: ResizeObserverEntry[]) => {
    const domSize = entries[0];
    const resizedEvent: ResizedEvent = {
      newRect: domSize.contentRect,
      oldRect,
      isFirst: !oldRect
    };

    oldRect = domSize.contentRect;
    resizeSignal.set(resizedEvent);
  };

  const observer = new ResizeObserver(observeEvent);
  observer.observe(element.nativeElement);

  destroyRef.onDestroy(() => {
    observer.disconnect();
  });

  return resizeSignal;
}
