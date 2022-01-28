import { ChangeDetectorRef, ViewRef, ElementRef } from "@angular/core";
import { Maybe } from "@dereekb/util";

/**
 * Triggers a detection change on the input view as long as the view has not been destroyed.
 * 
 * @param cdRef 
 */
export function safeDetectChanges(cdRef: ChangeDetectorRef): void {
  if (!(cdRef as ViewRef).destroyed) {
    cdRef.detectChanges();
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
