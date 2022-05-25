import { first } from 'rxjs';
import { Directive, Input } from '@angular/core';
import { FilterSourceConnector, FilterSource, FilterMapKey } from '@dereekb/rxjs';
import { provideFilterSource, provideFilterSourceConnector } from './filter.content';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';
import { Maybe } from '@dereekb/util';

/**
 * Acts as an "input" FilterSourceConnector for an FilterMap, as well as a source for the FilterSourceConnector.
 */
@Directive({
  selector: '[dbxFilterMapSourceConnector]',
  exportAs: 'dbxFilterMapSourceConnector',
  providers: [
    ...provideFilterSource(DbxFilterMapSourceConnectorDirective),
    ...provideFilterSourceConnector(DbxFilterMapSourceConnectorDirective)
  ]
})
export class DbxFilterMapSourceConnectorDirective<F> extends DbxFilterMapSourceDirective<F> implements FilterSourceConnector<F> {

  @Input('dbxFilterMapSourceConnector')
  override get key(): Maybe<FilterMapKey> {
    return this._key.value;
  }

  override set key(key: Maybe<FilterMapKey>) {
    this._key.next(key);
  }

  // MARK: FilterSourceConnector
  connectWithSource(filterSource: FilterSource<F>): void {
    this.instance$.pipe(first()).subscribe((x) => x.connectWithSource(filterSource));
  }

}
