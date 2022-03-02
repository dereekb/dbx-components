export enum DbxRouterTransitionEventType {
  /**
   * A transition started.
   */
  START = 'start',
  /**
   * A transition ended.
   */
  SUCCESS = 'ended'
}

export interface DbxRouterTransitionEvent {
  type: DbxRouterTransitionEventType;
}
