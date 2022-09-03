import { ClickableAnchor } from '@dereekb/dbx-core';
import { Pixels, FactoryWithRequiredInput, LatLngInputRef } from '@dereekb/util';

/**
 * DbxMapboxMarkerSize. Numbers are converted to pixels.
 */
export type DbxMapboxMarkerSize = 'small' | 'medium' | 'large' | 'tall' | Pixels;

export type DbxMapboxMarker = LatLngInputRef & {
  /**
   * icon
   */
  icon?: string;
  /**
   * label
   */
  label?: string;
  /**
   * Image URL
   */
  image?: string | FactoryWithRequiredInput<string, Pixels>;
  /**
   * Size of the marker.
   */
  size?: DbxMapboxMarkerSize;
  /**
   *
   */
  anchor?: ClickableAnchor;
  /**
   * Additional object styling
   */
  style?: object;
};

/**
 * MapFunction that converts the input data to a DbxMapboxMarker.
 */
export type DbxMapboxMarkerFactory<T> = (value: T, index: number) => DbxMapboxMarker;

/**
 * Creates the styling for rendering a dot.
 *
 * @param background
 * @param color
 * @returns
 */
export function dbxMapboxColoredDotStyle(background: string, color?: string) {
  return {
    background,
    padding: '2px',
    color: color || 'white',
    'border-radius': '50%'
  };
}
