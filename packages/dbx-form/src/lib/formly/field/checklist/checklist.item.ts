import { ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

export interface ChecklistItemDisplayContent<T = unknown> {
  /**
   * Label to display.
   */
  readonly label?: Maybe<string>;
  /**
   * Secondary label/value to display. May be used as the string value.
   */
  readonly sublabel?: Maybe<string>;
  /**
   * Hint/description to display.
   */
  readonly description?: Maybe<string>;
  /**
   * Whether or not to display the ripple. Is true by default if the anchor is present.
   */
  readonly ripple?: Maybe<boolean>;
  /**
   * Optional anchor to apply on the visible content.
   */
  readonly anchor?: Maybe<ClickableAnchor>;
  /**
   * Value metadata. How it is used depends on the display component used.
   */
  readonly meta?: Maybe<T>;
}

/**
 * Component used for rendering checklist content.
 *
 * Content is injected.
 */
export interface ChecklistItemFieldDisplayComponent<T = unknown> {
  setDisplayContent(displayContent: ChecklistItemDisplayContent<T>): void;
}
