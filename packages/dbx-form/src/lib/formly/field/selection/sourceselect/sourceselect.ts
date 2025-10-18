import { type SelectionDisplayValue } from './../selection';
import { type LoadingState } from '@dereekb/rxjs';
import { type Factory, type FactoryWithRequiredInput, type MapFunction, type Maybe, type PrimativeKey } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type ElementRef } from '@angular/core';

export interface SourceSelectValue<T extends PrimativeKey = PrimativeKey, M = unknown> {
  value: T;
  meta: M;
}

/**
 * Group of SourceSelectValues with a label.
 */
export interface SourceSelectValueGroup<T extends PrimativeKey = PrimativeKey, M = unknown> {
  /**
   * Label for this source.
   */
  readonly label: string;
  /**
   * Values
   */
  readonly values: SourceSelectValue<T, M>[];
}

/**
 * Display value configuration for a SourceSelectValue.
 */
export type SourceSelectDisplayValue<T extends PrimativeKey = PrimativeKey, M = unknown> = Omit<SelectionDisplayValue<T, M>, 'meta'> & Pick<SourceSelectValue<T, M>, 'meta'>;

/**
 * Display value configuration for a SourceSelectValue.
 */
export interface SourceSelectDisplayValueGroup<T extends PrimativeKey = PrimativeKey, M = unknown> {
  /**
   * Label for this source.
   */
  readonly label: string;
  /**
   * Values
   */
  readonly values: SourceSelectDisplayValue<T, M>[];
}

/**
 * Options for a SourceSelect input.
 */
export interface SourceSelectOptions<T extends PrimativeKey = PrimativeKey, M = unknown> {
  readonly nonGroupedValues: SourceSelectDisplayValue<T, M>[];
  readonly groupedValues: SourceSelectDisplayValueGroup<T, M>[];
}

/**
 * Returns an observable that loads all the display info for the input values.
 */
export type SourceSelectDisplayFunction<T extends PrimativeKey = PrimativeKey, M = unknown> = MapFunction<SourceSelectValue<T, M>[], Observable<SourceSelectDisplayValue<T, M>[]>>;

/**
 * Reads the value from the input meta value. Should always return the same value.
 */
export type SourceSelectMetaValueReader<T extends PrimativeKey = PrimativeKey, M = unknown> = MapFunction<M, T>;

/**
 * Returns an observable that loads the metadata of the input values.
 */
export type SourceSelectValueMetaLoader<T extends PrimativeKey = PrimativeKey, M = unknown> = FactoryWithRequiredInput<Observable<M[]>, T[]>;

export interface SourceSelectOpenFunctionParams {
  /**
   * Origin of the button for the SourceSelect
   */
  readonly origin: ElementRef;
}

/**
 * Returns an observable that returns an array of meta values to be added to the selection.
 */
export type SourceSelectOpenFunction<M = unknown> = FactoryWithRequiredInput<Observable<SourceSelectOpenSourceResult<M>>, SourceSelectOpenFunctionParams>;

/**
 * Returns an observable that returns an array of meta values to be added to the selection.
 */
export interface SourceSelectOpenSourceResult<M = unknown> {
  /**
   * The values to set entirely, clearing the current selection.
   *
   * If null/undefined, current values will not be replaced.
   */
  readonly set?: Maybe<M[]>;
  /**
   * New values to add to the selection, if applicable.
   *
   * If null/undefined, no values will be added to selection.
   *
   * Is ignored if "set" value is provided.
   */
  readonly select?: Maybe<M[]>;
  /**
   * New options to make available for selection, but are not automatically selected.
   *
   * If null/undefined, no options will be added.
   */
  readonly options?: Maybe<M[]>;
}

/**
 * Function used to return an observable for an array of SourceSelectLoadSource values.
 */
export type SourceSelectLoadSourcesFunction<M = unknown> = Factory<Observable<SourceSelectLoadSource<M>[]>>;

/**
 * Source that has a label and an observable of meta values.
 */
export interface SourceSelectLoadSource<M = unknown> {
  /**
   * Label for this source.
   */
  readonly label: string;
  /**
   * Metadata loaded from this source.
   */
  readonly meta: Observable<LoadingState<M[]>>;
}

export interface SourceSelectLoadSourceLoadingState<M = unknown> extends LoadingState<M[]> {
  /**
   * Label for this source.
   */
  readonly label: string;
}
