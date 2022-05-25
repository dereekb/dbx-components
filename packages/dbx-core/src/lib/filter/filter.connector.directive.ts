import { Directive } from '@angular/core';
import { AbstractFilterSourceConnectorDirective } from './filter.abstract.connector.directive';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';

/**
 * Used as a FilterSource and FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterSourceConnector]',
  providers: [
    ...provideFilterSource(DbxFilterSourceConnectorDirective),
    ...provideFilterSourceConnector(DbxFilterSourceConnectorDirective)
  ]
})
export class DbxFilterSourceConnectorDirective<F = unknown> extends AbstractFilterSourceConnectorDirective<F> { }
