import { Component, type OnDestroy, inject } from '@angular/core';
import { formatToDayRangeString, formatToISO8601DayStringForSystem } from '@dereekb/date';
import { DbxFilterMapSourceConnectorDirective, DbxFilterConnectSourceDirective, DbxFilterMapMergeSourceDirective, DbxFilterStorageService, clean } from '@dereekb/dbx-core';
import { FilterMap, type FilterMapKey } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { startOfDay } from 'date-fns';
import { forkJoin, map, of, type Observable } from 'rxjs';
import { type DocInteractionTestFilter, type DocInteractionTestMergedFilter, DOC_INTERACTION_TEST_PRESETS, docInteractionTestAttributesFilterSelectionCount, refreshDocInteractionTestDatePresetFilter } from '../component/filter';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxButtonSpacerDirective, DbxButtonComponent, type DbxButtonDisplayStylePair } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocInteractionTestFilterPopoverButtonComponent } from '../component/filter.popover.button.component';
import { DocInteractionTestFormFilterPopoverButtonComponent } from '../component/filter.form.popover.button.component';
import { DocInteractionTestDateFilterPopoverButtonComponent } from '../component/filter.date.popover.button.component';
import { DocInteractionTestFilterPresetMenuComponent } from '../component/filter.preset.menu.component';
import { DocInteractionTestFilterPartialPresetMenuComponent } from '../component/filter.partial.preset.menu.component';
import { DocInteractionTestFilterPresetFilterComponent } from '../component/filter.preset.component';
import { DocInteractionTestAttributesFilterPopoverButtonComponent } from '../component/filter.attributes.popover.button.component';
import { DocInteractionTestMergedFilterViewComponent } from '../component/filter.merged.view.component';
import { JsonPipe } from '@angular/common';

/**
 * Button display for a date filter, showing the selected date or date range.
 *
 * @param filter - Current date filter.
 * @returns The button display, or undefined if there is no filter yet.
 */
function displayForDateFilter(filter: Maybe<DocInteractionTestFilter>): Maybe<DbxButtonDisplayStylePair> {
  let result: Maybe<DbxButtonDisplayStylePair>;

  if (filter) {
    let text: string;

    if (filter.date) {
      text = filter.toDate ? formatToDayRangeString({ start: filter.date, end: filter.toDate }) : formatToISO8601DayStringForSystem(filter.date);
    } else {
      text = 'No Date';
    }

    result = {
      display: {
        icon: 'event',
        text
      }
    };
  }

  return result;
}

/**
 * Button display for the attributes filter. Shows the number of selections, and is highlighted while any are made.
 *
 * @param filter - Current attributes filter.
 * @returns The button display.
 */
function displayForAttributesFilter(filter: Maybe<DocInteractionTestMergedFilter>): DbxButtonDisplayStylePair {
  const count = docInteractionTestAttributesFilterSelectionCount(filter);

  return {
    display: {
      icon: 'tune',
      text: count ? `Filters (${count})` : 'Filters'
    },
    style: count ? { type: 'flat', color: 'primary' } : undefined
  };
}

@Component({
  templateUrl: './filter.component.html',
  providers: [FilterMap],
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DbxContentBorderDirective,
    DocInteractionTestFilterPopoverButtonComponent,
    DocInteractionTestFormFilterPopoverButtonComponent,
    DbxFilterMapSourceConnectorDirective,
    DbxButtonSpacerDirective,
    DocInteractionTestDateFilterPopoverButtonComponent,
    DocInteractionTestFilterPresetMenuComponent,
    DbxFilterConnectSourceDirective,
    DocInteractionTestFilterPartialPresetMenuComponent,
    DocInteractionTestFilterPresetFilterComponent,
    DocInteractionTestAttributesFilterPopoverButtonComponent,
    DocInteractionTestMergedFilterViewComponent,
    DbxFilterMapMergeSourceDirective,
    DbxButtonComponent,
    JsonPipe
  ]
})
export class DocInteractionFilterComponent implements OnDestroy {
  readonly filterMap = inject(FilterMap<DocInteractionTestFilter>);
  readonly mergedFilterMap = inject(FilterMap<DocInteractionTestMergedFilter>);
  readonly dbxFilterStorageService = inject(DbxFilterStorageService);

  readonly presets = DOC_INTERACTION_TEST_PRESETS;

  readonly buttonFilterKey: FilterMapKey = 'button';
  readonly formFilterKey: FilterMapKey = 'form';
  readonly menuFilterKey: FilterMapKey = 'menu';
  readonly listFilterKey: FilterMapKey = 'list';

  readonly mergedDateFilterKey: FilterMapKey = 'mergedDate';
  readonly mergedAttributesFilterKey: FilterMapKey = 'mergedAttributes';
  readonly mergedFilterKeys: FilterMapKey[] = [this.mergedDateFilterKey, this.mergedAttributesFilterKey];

  // each merged key loads its saved filter as its default, then saves every change
  readonly mergedDateFilterStorage = clean(
    this.dbxFilterStorageService.persistFilterMapKey<DocInteractionTestMergedFilter>({
      filterMap: this.mergedFilterMap,
      key: this.mergedDateFilterKey,
      storageKey: 'doc.filter.merged.date',
      defaultFilter: {},
      mapLoadedFilter: refreshDocInteractionTestDatePresetFilter
    })
  );

  readonly mergedAttributesFilterStorage = clean(
    this.dbxFilterStorageService.persistFilterMapKey<DocInteractionTestMergedFilter>({
      filterMap: this.mergedFilterMap,
      key: this.mergedAttributesFilterKey,
      storageKey: 'doc.filter.merged.attributes',
      defaultFilter: {}
    })
  );

  readonly filter$ = this.filterMap.filterForKey(this.buttonFilterKey);
  readonly formFilter$ = this.filterMap.filterForKey(this.formFilterKey);
  readonly menuFilter$ = this.filterMap.filterForKey(this.menuFilterKey);
  readonly listFilter$ = this.filterMap.filterForKey(this.listFilterKey);

  readonly mergedDateFilter$ = this.mergedFilterMap.filterForKey(this.mergedDateFilterKey);
  readonly mergedAttributesFilter$ = this.mergedFilterMap.filterForKey(this.mergedAttributesFilterKey);
  readonly mergedFilter$ = this.mergedFilterMap.mergedFilterForKeys(this.mergedFilterKeys);

  readonly displayForFilter$: Observable<Maybe<DbxButtonDisplayStylePair>> = this.filter$.pipe(
    map((filter) => {
      let result: Maybe<DbxButtonDisplayStylePair>;

      if (filter) {
        if (filter.date) {
          result = {
            display: {
              icon: 'event',
              text: formatToISO8601DayStringForSystem(filter.date)
            }
          };
        } else {
          result = {
            display: {
              icon: 'event',
              text: 'No Date'
            }
          };
        }
      }

      return result;
    })
  );

  readonly displayForDateFilter$: Observable<Maybe<DbxButtonDisplayStylePair>> = this.filter$.pipe(map(displayForDateFilter));
  readonly displayForMergedDateFilter$: Observable<Maybe<DbxButtonDisplayStylePair>> = this.mergedDateFilter$.pipe(map(displayForDateFilter));
  readonly displayForMergedAttributesFilter$: Observable<DbxButtonDisplayStylePair> = this.mergedAttributesFilter$.pipe(map(displayForAttributesFilter));

  readonly filterSignal = toSignal(this.filter$);
  readonly formFilterSignal = toSignal(this.formFilter$);
  readonly menuFilterSignal = toSignal(this.menuFilter$);
  readonly listFilterSignal = toSignal(this.listFilter$);
  readonly displayForFilterSignal = toSignal(this.displayForFilter$);
  readonly displayForDateFilterSignal = toSignal(this.displayForDateFilter$);

  readonly mergedDateFilterSignal = toSignal(this.mergedDateFilter$);
  readonly mergedAttributesFilterSignal = toSignal(this.mergedAttributesFilter$);
  readonly mergedFilterSignal = toSignal(this.mergedFilter$);
  readonly displayForMergedDateFilterSignal = toSignal(this.displayForMergedDateFilter$);
  readonly displayForMergedAttributesFilterSignal = toSignal(this.displayForMergedAttributesFilter$);

  constructor() {
    this.filterMap.addDefaultFilterObs(this.buttonFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.formFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.menuFilterKey, of({ date: startOfDay(new Date()) }));
    this.filterMap.addDefaultFilterObs(this.listFilterKey, of({}));
  }

  resetMergedFilters(): void {
    forkJoin([this.mergedDateFilterStorage.reset(), this.mergedAttributesFilterStorage.reset()]).subscribe();
  }

  ngOnDestroy(): void {
    this.filterMap.destroy();
  }
}
