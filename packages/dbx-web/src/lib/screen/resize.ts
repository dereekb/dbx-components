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
 * Creates a new Signal that emits resize events.
 *
 * Must called in an Angular injection context.
 *
 * @param inputElement The element to observe for resize events. If not provided, the host element will be injected.
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
