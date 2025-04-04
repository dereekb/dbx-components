import { FilterSource, FilterMapKey } from '@dereekb/rxjs';
import { switchMap, first, Observable } from 'rxjs';
import { Directive, effect, input } from '@angular/core';
import { provideFilterSource } from './filter.content';
import { AbstractDbxFilterMapInstanceDirective } from './filter.map.instance.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract directive that extends AbstractDbxFilterMapInstanceDirective and implements FilterSource.
 */
@Directive()
export abstract class AbstractDbxFilterMapSourceDirective<F> extends AbstractDbxFilterMapInstanceDirective<F> implements FilterSource<F> {
  readonly filter$: Observable<F> = this.instance$.pipe(switchMap((x) => x.filter$));

  initWithFilter(filterObs: Observable<F>): void {
    this.instance$.pipe(first()).subscribe((x) => x.initWithFilter(filterObs));
  }
}

/**
 * Provides a FilterSource from a parent FilterMap.
 */
@Directive({
  selector: '[dbxFilterMapSource]',
  exportAs: 'dbxFilterMapSource',
  providers: [provideFilterSource(DbxFilterMapSourceDirective)],
  standalone: true
})
export class DbxFilterMapSourceDirective<F> extends AbstractDbxFilterMapSourceDirective<F> implements FilterSource<F> {
  readonly dbxFilterMapSource = input<Maybe<FilterMapKey>>();
  protected readonly _dbxFilterMapSourceEffect = effect(() => this.setFilterMapKey(this.dbxFilterMapSource()));
}
