import { MonoTypeOperatorFunction, tap } from 'rxjs';
import { ChangeDetectorRef, ViewRef, ElementRef } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Convenience function used within observables for views that need to detect changes after a value changes.
 *
 * @param cdRef
 * @param timeout
 * @returns
 */
export function tapDetectChanges<T>(cdRef: Maybe<ChangeDetectorRef>, timeout = 0): MonoTypeOperatorFunction<T> {
  return cdRef ? tap(() => setTimeout(() => safeDetectChanges(cdRef), timeout)) : tap();
}

/**
 * Triggers a check for detecting any changes on the model safely to ve registered via detectChanges().
 *
 * @param cdRef
 */
export function safeDetectChanges(cdRef: ChangeDetectorRef): void {
  safeUseCdRef(cdRef, () => cdRef.detectChanges());
}

/**
 * Convenience function used within observables for views that use the OnPush ChangeDetectionStrategy and needs to call markForCheck when a new observable value is pushed.
 *
 * NOTE: If the observable is being consumed via the "async" pipe, this may not be necessary.
 *
 * @param cdRef
 * @param timeout
 * @returns
 */
export function tapSafeMarkForCheck<T>(cdRef: Maybe<ChangeDetectorRef>, timeout = 0): MonoTypeOperatorFunction<T> {
  return cdRef ? tap(() => setTimeout(() => safeMarkForCheck(cdRef), timeout)) : tap();
}

/**
 * Marks the ChangeDetectorRef for changes as long as the view has not been destroyed.
 *
 * @param cdRef
 */
export function safeMarkForCheck(cdRef: ChangeDetectorRef): void {
  safeUseCdRef(cdRef, () => cdRef.markForCheck());
}

/**
 * Triggers a detection change on the input view as long as the view has not been destroyed.
 *
 * @param cdRef
 */
export function safeUseCdRef(cdRef: ChangeDetectorRef, use: (cdRef: ChangeDetectorRef) => void): void {
  if (!(cdRef as ViewRef).destroyed) {
    use(cdRef);
  }
}

/**
 * Used to check an injected ElementRef that wraps an ng-content injection point whether or not any content was injected,
 * or more specifically if the parent component passed any target content to the child. This will still return true if
 * passed content is empty.
 *
 * TS:
 * @ViewChild('customLoading', { static: false }) customCustom: ElementRef;
 *
 * HTML:
 * <div #customContent>
 *  <ng-content select="[content]"></ng-content>
 * </div>
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
