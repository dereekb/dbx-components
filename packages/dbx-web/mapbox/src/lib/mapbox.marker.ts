import { ClickableAnchor } from '@dereekb/dbx-core';
import { Pixels, FactoryWithRequiredInput, LatLngInputRef, UniqueModel, CssClassesArray, Maybe, CssStyleObject } from '@dereekb/util';

/**
 * DbxMapboxMarkerSize. Numbers are converted to pixels.
 */
export type DbxMapboxMarkerSize = 'small' | 'medium' | 'large' | 'tall' | Pixels;

/**
 * Presentation style.
 *
 * - normal: Text under dot with optional icon within dot
 * - chip: "dbx-chip"-like presentation
 */
export type DbxMapboxMarkerPresentation = 'normal' | 'chip' | 'chip-small';

export interface DbxMapboxMarkerDisplayConfig {
  /**
   * Presentation style. Defaults to "normal"
   */
  readonly presentation?: DbxMapboxMarkerPresentation;
  /**
   * Additional classes to add to the marker.
   */
  readonly markerClasses?: Maybe<CssClassesArray>;
  /**
   * Marker icon to display.
   */
  readonly icon?: Maybe<string>;
  /**
   * Marker label to display.
   */
  readonly label?: Maybe<string>;
  /**
   * Image URL or Factory that returns an image URL.
   */
  readonly image?: Maybe<string | FactoryWithRequiredInput<string, Pixels>>;
  /**
   * Size of the marker.
   */
  readonly size?: Maybe<DbxMapboxMarkerSize>;
  /**
   * ClickableAnchor for the marker.
   */
  readonly anchor?: Maybe<ClickableAnchor>;
  /**
   * Additional icon content styling. Style is not applied to the entire marker. Use markerClasses instead.
   */
  readonly style?: Maybe<CssStyleObject>;
}

export type DbxMapboxMarker = UniqueModel & LatLngInputRef & DbxMapboxMarkerDisplayConfig;

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
    color: (color ?? background) ? 'white' : undefined,
    'border-radius': '50%'
  };
}
