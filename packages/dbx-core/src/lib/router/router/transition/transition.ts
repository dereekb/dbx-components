export enum DbNgxRouterTransitionEventType {
  /**
   * A transition started.
   */
  START = 'start',
  /**
   * A transition ended.
   */
  SUCCESS = 'ended'
}

export interface DbNgxRouterTransitionEvent {
  type: DbNgxRouterTransitionEventType;
}
