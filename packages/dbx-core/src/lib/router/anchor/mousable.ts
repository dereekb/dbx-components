import { type Maybe } from '@dereekb/util';

/**
 * Describes the type of mouse event: entering or leaving an element.
 */
export type MouseEventType = 'enter' | 'leave';

/**
 * Pairs a {@link MouseEventType} with associated data, allowing tracking of what element or context the mouse event relates to.
 *
 * @typeParam T - The type of data associated with the mouse event.
 *
 * @example
 * ```ts
 * const event: MouseEventPair<string> = { type: 'enter', data: 'menu-item-1' };
 * ```
 */
export interface MouseEventPair<T> {
  /** The type of mouse event that occurred. */
  readonly type: MouseEventType;
  /** Data associated with this mouse event. */
  readonly data: T;
}

/**
 * Interface for elements that support mouse enter/leave event handling.
 *
 * @example
 * ```ts
 * const mousable: MousableFunction = {
 *   onMouse: (type, event) => console.log(`Mouse ${type}`, event)
 * };
 * ```
 */
export interface MousableFunction {
  /** Optional handler invoked on mouse enter and leave events. */
  onMouse?: (type: MouseEventType, event?: Maybe<MouseEvent>) => void;
}
