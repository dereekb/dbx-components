import { Directive } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from './filter.abstract.source.directive';

/**
 * Provides a {@link FilterSource} in DI so child components can inject and consume the current filter value. Use this on a wrapper element when the child is the canonical owner of the filter (a filter form, a chip group).
 *
 * @dbxFilter
 * @dbxFilterSlug source
 * @dbxFilterRelated connect-source, source-connector, map-source
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterSource>
 *   <my-filter-form></my-filter-form>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterSource]',
  providers: provideFilterSourceDirective(DbxFilterSourceDirective),
  standalone: true
})
export class DbxFilterSourceDirective<F> extends AbstractFilterSourceDirective<F> {}
