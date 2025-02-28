import { ModelTypeDataPair, MapFunction } from '@dereekb/util';

/**
 * Widget type identifier
 */
export type DbxWidgetType = string;

/**
 * Type and data pair for a DbxWidget.
 */
export type DbxWidgetDataPair<T = unknown> = Readonly<ModelTypeDataPair<T>>;

/**
 * Used for converting the input data into a DbxWidgetDataPair value.
 */
export type DbxWidgetDataPairFactory<T> = MapFunction<T, DbxWidgetDataPair<T>>;

export interface DbxWidgetViewComponentConfig<T = unknown> extends DbxWidgetDataPair<T> {
  /**
   * Alternative, default type to use if this type is not known/configured.
   */
  readonly defaultType?: DbxWidgetType;
}
