import { ObservableOrValueGetter } from '@dereekb/rxjs';
import { ModelKeyRef, UniqueModel } from '@dereekb/util';
import { DbxInjectionComponentConfig } from './injection';

/**
 * A keyed configuration entry
 */
export interface DbxInjectionArrayEntry<T = unknown> extends ModelKeyRef {
  /**
   * Observable or value containing the DbxInjectionComponentConfig.
   */
  readonly injectionConfig: ObservableOrValueGetter<DbxInjectionComponentConfig<T>>;
}
