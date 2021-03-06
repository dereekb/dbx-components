/**
 * Object that must be "initialized".
 */
export interface Initialized {
  init(): void;
}

/**
 * Object that can be "destroyed" as a way to clean itself up.
 */
export interface Destroyable {
  destroy(): void;
}
