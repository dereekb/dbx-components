
export interface ClickableFunction {
  onClick?: (event?: MouseEvent) => void;
}

/**
 * Represents a clickable href/url configuration.
 */
export interface ClickableUrl {
  /**
   * href url
   */
  url?: string;
  /**
   * href target attribute.
   */
  target?: string;
}
