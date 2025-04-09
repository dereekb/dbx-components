import { first } from 'rxjs';
import { Directive, effect, input } from '@angular/core';
import { FilterSourceConnector, FilterSource, FilterMapKey } from '@dereekb/rxjs';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';
import { AbstractDbxFilterMapSourceDirective } from './filter.map.source.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Acts as an "input" FilterSourceConnector for an FilterMap, as well as a source for the FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterMapSourceConnector]',
  exportAs: 'dbxFilterMapSourceConnector',
  providers: [...provideFilterSource(DbxFilterMapSourceConnectorDirective), ...provideFilterSourceConnector(DbxFilterMapSourceConnectorDirective)],
  standalone: true
})
export class DbxFilterMapSourceConnectorDirective<F> extends AbstractDbxFilterMapSourceDirective<F> implements FilterSourceConnector<F> {
  readonly dbxFilterMapSourceConnector = input<Maybe<FilterMapKey>>();

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
