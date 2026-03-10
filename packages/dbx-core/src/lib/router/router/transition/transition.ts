/**
 * Enum describing the type of a router transition event.
 *
 * Used by {@link DbxRouterTransitionEvent} to categorize transition lifecycle events.
 *
 * @see {@link DbxRouterTransitionEvent}
 * @see {@link DbxRouterTransitionService}
 */
export enum DbxRouterTransitionEventType {
  /**
   * A transition started.
   */
  START = 'start',
  /**
   * A transition ended.
   */
  SUCCESS = 'success'
}

/**
 * Represents a router transition event emitted during navigation lifecycle.
 *
 * @example
 * ```ts
 * transitionService.transitions$.subscribe(event => {
 *   if (event.type === DbxRouterTransitionEventType.SUCCESS) {
 *     console.log('Navigation completed successfully');
 *   }
 * });
 * ```
 *
 * @see {@link DbxRouterTransitionEventType}
 * @see {@link DbxRouterTransitionService}
 */
export interface DbxRouterTransitionEvent {
  /** The type of transition event (start or success). */
  type: DbxRouterTransitionEventType;
}
