import { ChangeDetectorRef, Component, Directive, ElementRef, Injector, Input, OnDestroy } from '@angular/core';

/**
 * Used to reference a cdRef, injector, and element at the given element.
 *
 * Generally used for child views to reference a well-placed parent view.
 */
@Directive({
  selector: '[dbxStructure]'
})
export class DbxStructureDirective {
  constructor(readonly cdRef: ChangeDetectorRef, readonly injector: Injector, readonly element: ElementRef) {}
}
