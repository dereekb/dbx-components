import { Component, OnDestroy, inject } from '@angular/core';
import { formatToDayRangeString, formatToISO8601DayStringForSystem } from '@dereekb/date';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { FilterMap, FilterMapKey } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { startOfDay } from 'date-fns';
import { map, of, Observable } from 'rxjs';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from '../component/filter';

@Component({
  templateUrl: './filter.component.html',
  providers: [FilterMap]
})
export class DocInteractionFilterComponent implements OnDestroy {
  readonly filterMap = inject(FilterMap<DocInteractionTestFilter>);

  readonly presets = DOC_INTERACTION_TEST_PRESETS;

  readonly buttonFilterKey: FilterMapKey = 'button';
  readonly menuFilterKey: FilterMapKey = 'menu';
  readonly listFilterKey: FilterMapKey = 'list';

  readonly filter$ = this.filterMap.filterForKey(this.buttonFilterKey);
  readonly menuFilter$ = this.filterMap.filterForKey(this.menuFilterKey);
  readonly listFilter$ = this.filterMap.filterForKey(this.listFilterKey);

  readonly displayForFilter$: Observable<Maybe<DbxButtonDisplayContent>> = this.filter$.pipe(
    map((filter) => {
      let result: Maybe<DbxButtonDisplayContent>;

      if (filter) {
        if (filter.date) {
          result = {
            icon: 'event',
            text: formatToISO8601DayStringForSystem(filter.date)
          };
        } else {
          result = {
            icon: 'event',
            text: 'No Date'
          };
        }
      }

      return result;
    })
  );

  readonly displayForDateFilter$: Observable<Maybe<DbxButtonDisplayContent>> = this.filter$.pipe(
    map((filter) => {
      let result: Maybe<DbxButtonDisplayContent>;

      if (filter) {
        if (filter.date) {
          if (filter.toDate) {
            result = {
              icon: 'event',
              text: formatToDayRangeString({ start: filter.date, end: filter.toDate })
            };
          } else {
            result = {
              icon: 'event',
              text: formatToISO8601DayStringForSystem(filter.date)
            };
          }
        } else {
          result = {
            icon: 'event',
            text: 'No Date'
          };
        }
      }

      return result;
    })
  );

  constructor() {
    this.filterMap.addDefaultFilterObs(this.buttonFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.menuFilterKey, of({ date: startOfDay(new Date()) }));
    this.filterMap.addDefaultFilterObs(this.listFilterKey, of({}));
  }

  ngOnDestroy(): void {
    this.filterMap.destroy();
  }
}
