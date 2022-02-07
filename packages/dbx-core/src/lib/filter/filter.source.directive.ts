import { Directive } from '@angular/core';
import { ProvideFilterSource } from './filter.content';
import { AbstractFilterSourceDirective } from './filter.abstract.source.directive';

/**
 * Basic filter source directive.
 */
@Directive({
  selector: '[dbxFilterSource]',
  providers: ProvideFilterSource(DbxFilterSourceDirective)
})
export class DbxFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> { }
