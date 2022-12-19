import { SegueRef } from '@dereekb/dbx-core';
import { FactoryWithRequiredInput, ModelKey, ModelTypeString } from '@dereekb/util';

export interface DbxModelTypeConfiguration {
  /**
   * Popup label that can be used for these types.
   */
  label?: string;
  /**
   * Name used in analytics events. If not provided, label is used by default.
   */
  analyticsName?: string;
  /**
   * Model type this configuration is for.
   */
  modelType: ModelTypeString;
  /**
   * Sref factory for viewing objects of this type.
   */
  sref?: FactoryWithRequiredInput<SegueRef, ModelKey>;
  /**
   * Icon used to represent this model.
   */
  icon?: string;
}

export interface DbxModelTypeConfigurationMap {
  [key: string]: DbxModelTypeConfiguration;
}
