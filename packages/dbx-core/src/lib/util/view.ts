import { type MonoTypeOperatorFunction, tap } from 'rxjs';
import { type ChangeDetectorRef, type ViewRef, type ElementRef } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * RxJS operator that triggers `detectChanges()` on a `ChangeDetectorRef` after each emission.
 *
 * Wraps the detection call in a `setTimeout` to avoid triggering it during change detection cycles.
 *
 * @deprecated Use Angular signals instead.
 *
 * @param cdRef - The change detector to trigger. If `null`/`undefined`, the operator is a no-op.
 * @param timeout - Delay in milliseconds before calling `detectChanges`.
 * @returns An RxJS operator that triggers change detection on each emission.
 *
 * @example
 * ```typescript
 * this.data$.pipe(tapDetectChanges(this.cdRef)).subscribe();
 * ```
 */
export function tapDetectChanges<T>(cdRef: Maybe<ChangeDetectorRef>, timeout = 0): MonoTypeOperatorFunction<T> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return cdRef ? tap(() => setTimeout(() => safeDetectChanges(cdRef), timeout)) : tap();
}

/**
 * Safely calls `detectChanges()` on a `ChangeDetectorRef`, skipping the call if the view is already destroyed.
 *
 * @deprecated Use Angular signals instead.
 *
 * @param cdRef - The change detector to trigger.
 */
export function safeDetectChanges(cdRef: ChangeDetectorRef): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  safeUseCdRef(cdRef, () => cdRef.detectChanges());
}

/**
 * RxJS operator that calls `markForCheck()` on a `ChangeDetectorRef` after each emission.
 *
 * Intended for components using `OnPush` change detection that subscribe to observables
 * outside of the `async` pipe. Not needed when using the `async` pipe.
 *
 * @deprecated Use Angular signals instead.
 *
 * @param cdRef - The change detector to mark. If `null`/`undefined`, the operator is a no-op.
 * @param timeout - Delay in milliseconds before calling `markForCheck`.
 * @returns An RxJS operator that marks the view for check on each emission.
 *
 * @example
 * ```typescript
 * this.data$.pipe(tapSafeMarkForCheck(this.cdRef)).subscribe();
 * ```
 */
export function tapSafeMarkForCheck<T>(cdRef: Maybe<ChangeDetectorRef>, timeout = 0): MonoTypeOperatorFunction<T> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return cdRef ? tap(() => setTimeout(() => safeMarkForCheck(cdRef), timeout)) : tap();
}

/**
 * Safely calls `markForCheck()` on a `ChangeDetectorRef`, skipping the call if the view is already destroyed.
 *
 * @deprecated Use Angular signals instead.
 *
 * @param cdRef - The change detector to mark.
 */
export function safeMarkForCheck(cdRef: ChangeDetectorRef): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  safeUseCdRef(cdRef, () => cdRef.markForCheck());
}

/**
 * Executes a callback with the given `ChangeDetectorRef` only if its view has not been destroyed.
 *
 * @deprecated Use Angular signals instead.
 *
 * @param cdRef - The change detector to guard.
 * @param use - Callback to invoke with the change detector.
 */
export function safeUseCdRef(cdRef: ChangeDetectorRef, use: (cdRef: ChangeDetectorRef) => void): void {
  if (!(cdRef as ViewRef).destroyed) {
    use(cdRef);
  }
}

/**
 * Checks whether an `ng-content` wrapper element received any projected content from its parent.
 *
 * Returns `true` if the element has any child nodes, even if the projected content is empty.
 * Useful for conditionally showing fallback content when no projection is provided.
 *
 * @param ref - Reference to the wrapper element around `ng-content`.
 * @returns `true` if the wrapper element has any child nodes.
 *
 * @example
 * ```typescript
 * // In the component class:
 * @ViewChild('contentWrapper', { static: false }) contentRef: ElementRef;
 *
 * get hasContent(): boolean {
 *   return checkNgContentWrapperHasContent(this.contentRef);
 * }
 * ```
 *
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
    const node = nodes[i];

    if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
      result = true;
      break;
    }
  }

  return result;
}
