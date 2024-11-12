import { ChangeDetectorRef, Directive, ElementRef, Injector, inject } from '@angular/core';

/**
 * Used to reference a cdRef, injector, and element at the given element.
 *
 * Generally used for child views to reference a well-placed parent view.
 */
@Directive({
  selector: '[dbxStructure]'
})
export class DbxStructureDirective {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly injector = inject(Injector);
  readonly element = inject(ElementRef);
}
