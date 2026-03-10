import { Directive, ElementRef, Injector, inject } from '@angular/core';

/**
 * Exposes the Angular {@link Injector} and {@link ElementRef} at the host element, enabling child components to inject a reference to a well-placed parent element.
 *
 * @example
 * ```html
 * <div dbxStructure>
 *   <!-- Children can inject DbxStructureDirective to access this element's injector -->
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxStructure]',
  standalone: true
})
export class DbxStructureDirective {
  readonly injector = inject(Injector);
  readonly element = inject(ElementRef);
}
