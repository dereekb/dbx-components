import { ModelTypeDataPair, TypedModel, MapFunction, ReadKeyFunction } from '@dereekb/util';

/**
 * Widget type identifier
 */
export type DbxWidgetType = string;

/**
 * Type and data pair for a DbxWidget.
 */
export type DbxWidgetDataPair<T = unknown> = ModelTypeDataPair<T>;

/**
 * Used for converting the input data into a DbxWidgetDataPair value.
 */
export type DbxWidgetDataPairFactory<T> = MapFunction<T, DbxWidgetDataPair<T>>;
