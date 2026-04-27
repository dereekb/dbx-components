import { first } from 'rxjs';
import { Directive, effect, input } from '@angular/core';
import { type FilterSourceConnector, type FilterSource, type FilterMapKey } from '@dereekb/rxjs';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';
import { AbstractDbxFilterMapSourceDirective } from './filter.map.source.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Both {@link FilterSource} and {@link FilterSourceConnector} for a keyed entry in an ancestor {@link FilterMap}. Connects an external filter source to one map slot and re-emits that slot's filter.
 *
 * @dbxFilter
 * @dbxFilterSlug map-source-connector
 * @dbxFilterRelated map, map-source
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSourceConnector]="'profileList'">
 *     <my-list></my-list>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMapSourceConnector]',
  exportAs: 'dbxFilterMapSourceConnector',
  providers: [...provideFilterSource(DbxFilterMapSourceConnectorDirective), ...provideFilterSourceConnector(DbxFilterMapSourceConnectorDirective)],
  standalone: true
})
export class DbxFilterMapSourceConnectorDirective<F> extends AbstractDbxFilterMapSourceDirective<F> implements FilterSourceConnector<F> {
  /**
   * The map key this connector binds to.
   */
  readonly dbxFilterMapSourceConnector = input<Maybe<FilterMapKey>>();
  protected readonly _dbxFilterMapSourceConnectorEffect = effect(() => this.setFilterMapKey(this.dbxFilterMapSourceConnector()));

  // MARK: FilterSourceConnector
  connectWithSource(filterSource: FilterSource<F>): void {
    this.instance$.pipe(first()).subscribe((x) => {
      x.connectWithSource(filterSource);

      if (filterSource.initWithFilter) {
        filterSource.initWithFilter(this.filter$);
      }
    });
  }
}
