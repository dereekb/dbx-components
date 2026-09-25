import { distinctUntilObjectValuesChanged, FilterMap, type FilterSource, type FilterMapKey, filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';
import { shareReplay, switchMap, type Observable } from 'rxjs';
import { provideFilterSource } from './filter.content';

/**
 * Provides a read-only {@link FilterSource} that merges the filters of several keys in an ancestor {@link FilterMap} into one filter. Lets separate filter controls (e.g. a date popover and an attributes popover) each own a key while children consume a single combined filter.
 *
 * Keys later in the array win when two keys set the same field, and the merged filter has no `preset`. Every key needs a value (e.g. a default filter) before the merged filter emits.
 *
 * @dbxFilter
 * @dbxFilterSlug map-merge-source
 * @dbxFilterRelated map, map-source, map-source-connector
 * @dbxFilterSkillRefs dbx__ref__dbx-component-patterns
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <my-date-filter-button [dbxFilterMapSourceConnector]="'date'"></my-date-filter-button>
 *   <my-attributes-filter-button [dbxFilterMapSourceConnector]="'attributes'"></my-attributes-filter-button>
 *   <div [dbxFilterMapMergeSource]="['date', 'attributes']">
 *     <my-filtered-list></my-filtered-list>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMapMergeSource]',
  exportAs: 'dbxFilterMapMergeSource',
  providers: [provideFilterSource(DbxFilterMapMergeSourceDirective)]
})
export class DbxFilterMapMergeSourceDirective<F> implements FilterSource<F> {
  readonly dbxFilterMap = inject(FilterMap<F>);

  /**
   * The map keys to merge, in priority order.
   */
  readonly dbxFilterMapMergeSource = input<Maybe<FilterMapKey[]>>();

  readonly filterMapKeys$ = toObservable(this.dbxFilterMapMergeSource).pipe(filterMaybe(), distinctUntilObjectValuesChanged());

  readonly filter$: Observable<F> = this.filterMapKeys$.pipe(
    switchMap((keys) => this.dbxFilterMap.mergedFilterForKeys(keys)),
    shareReplay(1)
  );
}
