import { type ElementRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Checks whether an `ng-content` wrapper element received any projected content from its parent.
 *
 * Returns `true` if the element has any child nodes, even if the projected content is empty.
 * Useful for conditionally showing fallback content when no projection is provided.
 *
 * @param ref - Reference to the wrapper element around `ng-content`.
 * @returns `true` if the wrapper element has any child nodes.
 *
 * @ViewChild ('contentWrapper', { static: false }) contentRef: ElementRef;
 *
 * get hasContent(): boolean {
 *   return checkNgContentWrapperHasContent(this.contentRef);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In the component class:
 * @example
 * ```html
 * <!-- In the component template: -->
 * <div #contentWrapper>
 *   <ng-content select="[content]"></ng-content>
 * </div>
 * <div *ngIf="!hasContent">No content provided</div>
 * ```
 */
export function checkNgContentWrapperHasContent(ref: Maybe<ElementRef<Element>>): boolean {
  // https://github.com/angular/angular/issues/26083
  let hasContent = false;

  if (ref != null) {
    const childNodes = ref.nativeElement.childNodes;
    const hasChildNodes = childNodes && childNodes.length > 0;
    hasContent = Boolean(hasChildNodes);
  }

  return hasContent;
}

/**
 * Checks whether an element has any meaningful child nodes (non-whitespace text or element nodes).
 *
 * Useful for detecting whether projected content was provided to a component by checking
 * the host element's child nodes at construction time, before Angular moves them for content projection.
 *
 * @param element - The host element to check.
 * @returns `true` if the element has at least one element child or non-whitespace text node.
 *
 * @example
 * ```typescript
 * constructor() {
 *   const el = inject(ElementRef<HTMLElement>);
 *   this._hasProjectedContent = hasNonTrivialChildNodes(el.nativeElement);
 * }
 * ```
 */
export function hasNonTrivialChildNodes(element: HTMLElement): boolean {
  const nodes = element.childNodes;
  let result = false;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);

    if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
      result = true;
      break;
    }
  }

  return result;
}
