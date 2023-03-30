/**
 * Camera zoom level.
 */
export type ZoomLevel = number;

/**
 * Reference to a zoom level
 */
export interface ZoomLevelRef {
  z: ZoomLevel;
}

/**
 * Camera zoom level range.
 */
export interface ZoomLevelRange {
  min: ZoomLevel;
  max: ZoomLevel;
}
