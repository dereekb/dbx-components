import { FilterSource, FilterMapKey } from '@dereekb/rxjs';
import { switchMap, first, Observable } from 'rxjs';
import { Directive, Input } from '@angular/core';
import { provideFilterSource } from './filter.content';
import { AbstractDbxFilterMapInstanceDirective } from './filter.map.instance.directive';
import { Maybe } from '@dereekb/util';

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive({
  selector: '[dbxFilterMapSource]',
  exportAs: 'dbxFilterMapSource',
  providers: [
    ...provideFilterSource(DbxFilterMapSourceDirective)
  ]
})
export class DbxFilterMapSourceDirective<F> extends AbstractDbxFilterMapInstanceDirective<F> implements FilterSource<F> {

  readonly filter$: Observable<F> = this.instance$.pipe(switchMap(x => x.filter$));

  @Input('dbxFilterMapSource')
  get key(): Maybe<FilterMapKey> {
    return this._key.value;
  }

  set key(key: Maybe<FilterMapKey>) {
    this._key.next(key);
  }

  initWithFilter?(filterObs: Observable<F>): void {
    this.instance$.pipe(first()).subscribe((x) => x.initWithFilter(filterObs));
  }

}
