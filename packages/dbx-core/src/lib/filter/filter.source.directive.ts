import { Directive } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from './filter.abstract.source.directive';

/**
 * Provides a {@link FilterSource} in the DI tree, allowing child components to inject and consume filter state.
 *
 * @example
 * ```html
 * <div dbxFilterSource>
 *   <my-list-component></my-list-component>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterSource]',
  providers: provideFilterSourceDirective(DbxFilterSourceDirective),
  standalone: true
})
export class DbxFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> {}
