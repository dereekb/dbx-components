import { type FilterSource, type FilterMapKey } from '@dereekb/rxjs';
import { switchMap, first, type Observable } from 'rxjs';
import { Directive, effect, input } from '@angular/core';
import { provideFilterSource } from './filter.content';
import { AbstractDbxFilterMapInstanceDirective } from './filter.map.instance.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract directive that extends {@link AbstractDbxFilterMapInstanceDirective} to also implement {@link FilterSource},
 * emitting the filter values from the resolved filter map instance.
 *
 * @typeParam F - The filter type.
 */
@Directive()
export abstract class AbstractDbxFilterMapSourceDirective<F> extends AbstractDbxFilterMapInstanceDirective<F> implements FilterSource<F> {
  readonly filter$: Observable<F> = this.instance$.pipe(switchMap((x) => x.filter$));

  initWithFilter(filterObs: Observable<F>): void {
    this.instance$.pipe(first()).subscribe((x) => x.initWithFilter(filterObs));
  }
}

/**
 * Provides a {@link FilterSource} for a keyed entry in an ancestor {@link FilterMap}. Children can inject the source as if it were the only filter on the page; the map dispatches by key.
 *
 * @dbxFilter
 * @dbxFilterSlug map-source
 * @dbxFilterRelated map, map-source-connector
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSource]="'profileList'">
 *     <my-filtered-list></my-filtered-list>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMapSource]',
  exportAs: 'dbxFilterMapSource',
  providers: [provideFilterSource(DbxFilterMapSourceDirective)],
  standalone: true
})
export class DbxFilterMapSourceDirective<F> extends AbstractDbxFilterMapSourceDirective<F> implements FilterSource<F> {
  /**
   * The map key this source binds to.
   */
  readonly dbxFilterMapSource = input<Maybe<FilterMapKey>>();
  protected readonly _dbxFilterMapSourceEffect = effect(() => this.setFilterMapKey(this.dbxFilterMapSource()));
}
