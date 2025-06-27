import { Directive, inject, ElementRef, output, effect } from '@angular/core';
import { ResizedEvent, resizeSignal } from './resize';

/**
 * Directive that emits resize events when the parent element is resized.
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
