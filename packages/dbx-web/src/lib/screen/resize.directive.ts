import { Directive, inject, ElementRef, output, effect } from '@angular/core';
import { type ResizedEvent, resizeSignal } from './resize';

/**
 * Emits {@link ResizedEvent} values whenever the host element is resized.
 *
 * Uses a `ResizeObserver` internally via {@link resizeSignal}.
 *
 * @example
 * ```html
 * <div dbxResized (dbxResized)="onResize($event)">
 *   Resizable content
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxResized]',
  standalone: true
})
export class DbxResizedDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly resizedSignal = resizeSignal(this.elementRef);
  readonly dbxResized = output<ResizedEvent>();

  protected _resizeEffect = effect(() => {
    this.dbxResized.emit(this.resizedSignal());
  });
}
