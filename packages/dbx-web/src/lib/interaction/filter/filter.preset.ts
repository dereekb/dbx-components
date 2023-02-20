import { shareReplay, BehaviorSubject, map, Observable, combineLatest, distinctUntilChanged, startWith } from 'rxjs';
import { Directive, Input, OnDestroy } from '@angular/core';
import { ClickableFilterPreset, ClickableAnchorLink, FilterSourceDirective } from '@dereekb/dbx-core';
import { getValueFromGetter, Maybe, objectHasNoKeys } from '@dereekb/util';
import { FilterWithPreset } from '@dereekb/rxjs';

/**
 * Displays a button and menu for filtering presets.
 */
@Directive()
export abstract class AbstractDbxPresetFilterMenuComponent<F extends FilterWithPreset> implements OnDestroy {
  private _presets = new BehaviorSubject<ClickableFilterPreset<F>[]>([]);

  readonly selected$: Observable<Maybe<F>> = this.filterSourceDirective.filter$.pipe(startWith(undefined), distinctUntilChanged());
  readonly selectedPresetString$: Observable<Maybe<string>> = this.selected$.pipe(
    map((selectedFilter) => (selectedFilter ? selectedFilter.preset : undefined)),
    distinctUntilChanged()
  );

  readonly presetAnchors$: Observable<ClickableAnchorLink[]> = combineLatest([this._presets, this.selectedPresetString$]).pipe(
    map(([presets, selectedPresetString]) => {
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

  readonly selectedPreset$: Observable<Maybe<ClickableFilterPreset<F>>> = combineLatest([this._presets, this.selectedPresetString$]).pipe(
    map(([presets, selectedPresetString]) => {
      return selectedPresetString != null ? presets.find((x) => x.preset === selectedPresetString) : undefined;
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
    const presetValue = preset.presetValue;

    if (presetValue == null || objectHasNoKeys(presetValue)) {
      this.filterSourceDirective.setFilter((presetValue ?? {}) as F);
      this.filterSourceDirective.resetFilter();
    } else {
      let filter = getValueFromGetter(preset.presetValue) as F;

      if (filter.preset !== preset.preset) {
        filter = {
          ...filter,
          preset: preset.preset
        };
      }

      this.filterSourceDirective.setFilter(filter);
    }
  }

  ngOnDestroy(): void {
    this._presets.complete();
  }
}
