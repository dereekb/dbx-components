
export enum ScreenMediaWidthType {
  /**
   * Screen is considered mobile.
   */
  MICRO,
  /**
   * Screen is consider small.
   */
  SMALL,
  /**
   * Screen is considered tablet size.
   */
  TABLET,
  /**
   * Screen is considered large than a tablet, but not full size.
   */
  LARGE,
  /**
   * Screen is greater than 768px.
   */
  FULL
}

export enum ScreenMediaHeightType {
  /**
   * Screen height is tiny, potentially the size of the navigation alone.
   */
  TINY,
  /**
   * Screen has a normal height.
   */
  NORMAL
}
