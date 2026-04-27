import { Directive, inject } from '@angular/core';
import { FilterMap } from '@dereekb/rxjs';
import { clean } from '../rxjs/clean';

/**
 * Provides a {@link FilterMap} instance in DI so multiple child sources can register / look up filters by string key. Use when one screen needs several independent filter contexts.
 *
 * @dbxFilter
 * @dbxFilterSlug map
 * @dbxFilterRelated map-source, map-source-connector
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSource]="'listA'">...</div>
 *   <div [dbxFilterMapSource]="'listB'">...</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMap]',
  exportAs: 'dbxFilterMap',
  providers: [FilterMap],
  standalone: true
})
export class DbxFilterMapDirective<F> {
  readonly filterMap = clean(inject(FilterMap<F>));
}
