import { Directive } from '@angular/core';
import { provideFilterSource } from './filter.content';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from './filter.abstract.source.directive';

/**
 * Basic filter source directive.
 */
@Directive({
  selector: '[dbxFilterSource]',
  providers: provideFilterSourceDirective(DbxFilterSourceDirective)
})
export class DbxFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> {}
