import { ClickableAnchor } from "@dereekb/dbx-core";
import { Maybe } from "packages/util/src/lib/value";
import { Observable } from "rxjs";

export interface ChecklistItemDisplayContent<T = any> {
  /**
   * Label to display.
   */
  label?: Maybe<string>;
  /**
   * Secondary label/value to display. May be used as the string value.
   */
  sublabel?: Maybe<string>;
  /**
  * Hint/description to display.
  */
  description?: Maybe<string>;
  /**
   * Whether or not to display the ripple. Is true by default if the anchor is present.
   */
  ripple?: Maybe<boolean>;
  /**
   * Optional anchor to apply on the visible content.
   */
  anchor?: Maybe<ClickableAnchor>;
  /**
   * Value metadata. How it is used depends on the display component used.
   */
  meta?: Maybe<T>;
}

/**
 * Component used for rendering checklist content.
 * 
 * Content is injected.
 */
export interface ChecklistItemFieldDisplayComponent<T = any> {
  displayContent?: ChecklistItemDisplayContent<T>;
}

export type ChecklistItemFieldDisplayContentObs<T = any> = Observable<ChecklistItemDisplayContent<T>>;
