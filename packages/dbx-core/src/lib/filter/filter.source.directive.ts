import { Directive } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from './filter.abstract.source.directive';

/**
 * Basic filter source directive.
 */
@Directive({
  selector: '[dbxFilterSource]',
  providers: provideFilterSourceDirective(DbxFilterSourceDirective),
  standalone: true
})
export class DbxFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> {}
