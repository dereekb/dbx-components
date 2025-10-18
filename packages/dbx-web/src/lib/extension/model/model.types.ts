import { type Injector } from '@angular/core';
import { type SegueRef } from '@dereekb/dbx-core';
import { type Maybe, type ModelKey, type ModelTypeString } from '@dereekb/util';
import { type ModelViewContext } from './model.tracker';

/**
 * Generates a SegueRef based on the input model's key and optional view context, or returns null/undefined if no ref is available.
 */
export type DbxModelTypeConfigurationSrefFactory = (key: ModelKey, context?: ModelViewContext) => Maybe<SegueRef>;

/**
 * Generates a DbxModelTypeConfigurationSrefFactory.
 */
export type DbxModelTypeConfigurationSrefFactoryBuilder = (injector: Injector) => DbxModelTypeConfigurationSrefFactory;

export interface DbxModelTypeConfiguration {
  /**
   * Popup label that can be used for these types.
   */
  readonly label?: string;
  /**
   * Name used in analytics events. If not provided, label is used by default.
   */
  readonly analyticsName?: string;
  /**
   * Model type this configuration is for.
   */
  readonly modelType: ModelTypeString;
  /**
   * Sref factory for viewing objects of this type.
   */
  readonly sref?: DbxModelTypeConfigurationSrefFactory;
  /**
   * DbxModelTypeConfigurationSrefFactoryBuilder
   */
  readonly srefBuilder?: DbxModelTypeConfigurationSrefFactoryBuilder;
  /**
   * Icon used to represent this model.
   */
  readonly icon?: string;
}

export interface DbxModelTypeConfigurationMap {
  [key: string]: DbxModelTypeConfiguration;
}
