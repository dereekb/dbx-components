import { Maybe, WebsiteUrl } from '@dereekb/util';

export interface ClickableFunction {
  onClick?: (event?: Maybe<MouseEvent>) => void;
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

export function clickableUrlInNewTab(url: string | WebsiteUrl): ClickableUrl {
  return {
    url,
    target: '_blank'
  };
}
