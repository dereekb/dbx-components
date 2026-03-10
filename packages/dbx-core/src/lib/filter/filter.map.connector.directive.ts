import { first } from 'rxjs';
import { Directive, effect, input } from '@angular/core';
import { type FilterSourceConnector, type FilterSource, type FilterMapKey } from '@dereekb/rxjs';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';
import { AbstractDbxFilterMapSourceDirective } from './filter.map.source.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Directive that acts as both a {@link FilterSourceConnector} and {@link FilterSource} for a keyed entry in a parent {@link FilterMap}.
 *
 * Connects an external filter source to a specific filter map entry and re-emits that entry's filter.
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSourceConnector]="'myList'">
 *     <my-list-component></my-list-component>
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
