import { shareReplay } from 'rxjs/operators';
import { BehaviorSubject, map, Observable, combineLatest, distinctUntilChanged } from 'rxjs';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective, ClickableAnchor, ClickableAnchorLink, ClickableIconAnchorLink, FilterSourceDirective } from '@dereekb/dbx-core';
import { ClickableFilterPreset } from './filter.preset';
import { GetterOrValue, getValueFromGetter, Maybe } from '@dereekb/util';
import { FilterPresetStringRef, FilterWithPreset, tapLog } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-preset-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchors$ | async"></dbx-anchor-list>
  `
})
export class DbxPresetFilterListComponent<F extends FilterWithPreset> implements OnDestroy {
  private _presets = new BehaviorSubject<ClickableFilterPreset<F>[]>([]);

  readonly selected$ = this.filterSourceDirective.filter$.pipe(distinctUntilChanged());

  readonly presetAnchors$: Observable<ClickableAnchorLink[]> = combineLatest([this._presets, this.selected$]).pipe(
    map(([presets, selectedFilter]) => {
      const selectedPresetString = selectedFilter ? selectedFilter.preset : undefined;

      return presets.map((x) => ({
        ...x,
        selected: x.preset === selectedPresetString,
        onClick: () => {
          this.selectPreset(x);
        }
      }));
    }),
    shareReplay(1)
  );

  @Input()
  get presets(): ClickableFilterPreset<F>[] {
    return this._presets.value;
  }

  set presets(presets: ClickableFilterPreset<F>[]) {
    this._presets.next(presets);
  }

  constructor(readonly filterSourceDirective: FilterSourceDirective<F>) {}

  selectPreset(preset: ClickableFilterPreset<F>) {
    let filter = getValueFromGetter(preset.presetValue) as F;

    if (filter.preset !== preset.preset) {
      filter = {
        ...filter,
        preset: preset.preset
      };
    }

    this.filterSourceDirective.setFilter(filter);
  }

  ngOnDestroy(): void {
    this._presets.complete();
  }
}
