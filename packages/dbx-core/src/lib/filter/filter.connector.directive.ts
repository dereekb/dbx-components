import { Directive } from '@angular/core';
import { AbstractFilterSourceConnectorDirective } from './filter.abstract.connector.directive';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';

/**
 * Acts as both {@link FilterSource} and {@link FilterSourceConnector} — bridges a filter from one part of the template to another. Pair with `[dbxFilterConnectSource]` on the inner element that owns the source.
 *
 * @dbxFilter
 * @dbxFilterSlug source-connector
 * @dbxFilterRelated source, connect-source
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterSourceConnector>
 *   <my-filter-form dbxFilterSource dbxFilterConnectSource></my-filter-form>
 *   <my-list></my-list>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterSourceConnector]',
  providers: [...provideFilterSource(DbxFilterSourceConnectorDirective), ...provideFilterSourceConnector(DbxFilterSourceConnectorDirective)],
  standalone: true
})
export class DbxFilterSourceConnectorDirective<F = unknown> extends AbstractFilterSourceConnectorDirective<F> {}
