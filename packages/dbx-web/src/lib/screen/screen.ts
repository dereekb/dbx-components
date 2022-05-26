/**
 * Set of screen media width types. Their pixel sizes correspond with the DbxScreenMediaService's configuration.
 *
 * Values:
 * - micro: Screen is considered mobile.
 * - small: Screen is consider small, but larger than mobile.
 * - tablet: Screen is considered tablet size.
 * - large: Screen is considered large than a tablet, but not full size.
 * - full: Screen is greater than large.
 */
export type ScreenMediaWidthType = 'micro' | 'small' | 'tablet' | 'large' | 'full';

export const SCREEN_MEDIA_WIDTH_TYPE_SIZE_MAP = {
  micro: 0,
  small: 1,
  tablet: 2,
  large: 3,
  full: 4
};

/**
 * Describes the current screen's vertical space.
 *
 * Values:
 * - tiny: Screen height is tiny, potentially the size of the navigation alone.
 * - normal: Screen has a normal height.
 */
export type ScreenMediaHeightType = 'tiny' | 'normal';

/**
 * Compares the breakpoint with the current width and determines if it is "active" or not.
 *
 * The current is considered active if it is bigger or equal to the breakpoint.
 *
 * @param current
 * @param breakpoint
 */
export function screenMediaWidthTypeIsActive(current: ScreenMediaWidthType, breakpoint: ScreenMediaWidthType) {
  return compareScreenMediaWidthTypes(current, breakpoint, (a, b) => a >= b);
}

export function compareScreenMediaWidthTypes(a: ScreenMediaWidthType, b: ScreenMediaWidthType, compare: (a: number, b: number) => boolean) {
  return compare(SCREEN_MEDIA_WIDTH_TYPE_SIZE_MAP[a], SCREEN_MEDIA_WIDTH_TYPE_SIZE_MAP[b]);
}
