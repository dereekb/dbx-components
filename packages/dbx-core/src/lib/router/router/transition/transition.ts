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

export interface DbxRouterTransitionEvent {
  type: DbxRouterTransitionEventType;
}
