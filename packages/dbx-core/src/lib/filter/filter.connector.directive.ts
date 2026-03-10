import { Directive } from '@angular/core';
import { AbstractFilterSourceConnectorDirective } from './filter.abstract.connector.directive';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';

/**
 * Concrete directive that acts as both a {@link FilterSource} and {@link FilterSourceConnector}.
 *
 * Place on an element to bridge a filter source from one part of the template to another.
 *
 * @example
 * ```html
 * <div dbxFilterSourceConnector>
 *   <my-list-component></my-list-component>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterSourceConnector]',
  providers: [...provideFilterSource(DbxFilterSourceConnectorDirective), ...provideFilterSourceConnector(DbxFilterSourceConnectorDirective)],
  standalone: true
})
export class DbxFilterSourceConnectorDirective<F = unknown> extends AbstractFilterSourceConnectorDirective<F> {}
