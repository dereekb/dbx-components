import { Directive } from '@angular/core';
import { AbstractFilterSourceConnectorDirective } from './filter.abstract.connector.directive';
import { ProvideFilterSource, ProvideFilterSourceConnector } from './filter.content';

/**
 * Used as a FilterSource and FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterSourceConnector]',
  providers: [
    ...ProvideFilterSource(DbxFilterSourceConnectorDirective),
    ...ProvideFilterSourceConnector(DbxFilterSourceConnectorDirective)
  ]
})
export class DbxFilterSourceConnectorDirective<F> extends AbstractFilterSourceConnectorDirective<F> { }
