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
 * Concrete directive that provides a {@link FilterSource} from a keyed entry in a parent {@link FilterMap}.
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSource]="'listFilter'">
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
  readonly dbxFilterMapSource = input<Maybe<FilterMapKey>>();
  protected readonly _dbxFilterMapSourceEffect = effect(() => this.setFilterMapKey(this.dbxFilterMapSource()));
}
