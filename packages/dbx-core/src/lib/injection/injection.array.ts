import { type ObservableOrValueGetter } from '@dereekb/rxjs';
import { type ModelKeyRef } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from './injection';

/**
 * A keyed configuration entry
 */
export interface DbxInjectionArrayEntry<T = unknown> extends ModelKeyRef {
  /**
   * Observable or value containing the DbxInjectionComponentConfig.
   */
  readonly injectionConfig: ObservableOrValueGetter<DbxInjectionComponentConfig<T>>;
}
