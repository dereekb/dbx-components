import { type ObservableOrValueGetter } from '@dereekb/rxjs';
import { type ModelKeyRef } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from './injection';

/**
 * A keyed entry that pairs a unique model key with a {@link DbxInjectionComponentConfig},
 * enabling Angular's `@for` / `trackBy` to efficiently diff arrays of dynamic injection configs.
 *
 * Used by {@link DbxInjectionArrayComponent} to render a list of dynamically injected components.
 *
 * @typeParam T - The type of the component described by the injection config.
 *
 * @see {@link DbxInjectionArrayComponent}
 *
 * @example
 * ```typescript
 * const entries: DbxInjectionArrayEntry[] = [
 *   { key: 'a', injectionConfig: { componentClass: WidgetA } },
 *   { key: 'b', injectionConfig: { componentClass: WidgetB } }
 * ];
 * ```
 */
export interface DbxInjectionArrayEntry<T = unknown> extends ModelKeyRef {
  /**
   * The injection configuration (or an observable/getter that produces one) for this entry.
   */
  readonly injectionConfig: ObservableOrValueGetter<DbxInjectionComponentConfig<T>>;
}
