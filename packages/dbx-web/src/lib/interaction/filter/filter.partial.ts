import { shareReplay, BehaviorSubject, map, Observable, combineLatest, distinctUntilChanged, startWith, first } from 'rxjs';
import { Directive, Input, OnDestroy, inject } from '@angular/core';
import { ClickableAnchorLink, FilterSourceDirective, ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { filterUndefinedValues, firstValue, getValueFromGetter, Maybe, objectHasNoKeys } from '@dereekb/util';

/**
 * Displays a button and menu for filtering partialPresets.
 */
@Directive()
export abstract class AbstractDbxPartialPresetFilterMenuDirective<F> implements OnDestroy {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  private _partialPresets = new BehaviorSubject<ClickablePartialFilterPreset<F>[]>([]);

  readonly filter$: Observable<Maybe<F>> = this.filterSourceDirective.filter$.pipe(startWith(undefined), distinctUntilChanged(), shareReplay(1));

  readonly selectedPartialPresets$: Observable<ClickablePartialFilterPreset<F>[]> = combineLatest([this._partialPresets, this.filter$]).pipe(
    map(([partialPresets, selectedFilter]) => {
      const selectedPresets: ClickablePartialFilterPreset<F>[] = partialPresets.filter((x) => x.isActive(selectedFilter));
      return selectedPresets;
    }),
    distinctUntilChanged()
  );

  readonly firstSelectedPartialPreset$: Observable<Maybe<ClickablePartialFilterPreset<F>>> = this.selectedPartialPresets$.pipe(
    map((selectedPartialPresets) => firstValue(selectedPartialPresets)),
    distinctUntilChanged()
  );

  readonly presetAnchors$: Observable<ClickableAnchorLink[]> = combineLatest([this._partialPresets, this.firstSelectedPartialPreset$]).pipe(
    map(([partialPresets, firstSelectedPartialPreset]) => {
      return partialPresets.map((x) => {
        return {
          ...x,
          selected: x === firstSelectedPartialPreset,
          onClick: () => {
            this.selectPartialPreset(x);
          }
        };
      });
    }),
    shareReplay(1)
  );

  @Input()
  get partialPresets(): ClickablePartialFilterPreset<F>[] {
    return this._partialPresets.value;
  }

  set partialPresets(partialPresets: ClickablePartialFilterPreset<F>[]) {
    this._partialPresets.next(partialPresets);
  }

  selectPartialPreset(preset: ClickablePartialFilterPreset<F>) {
    const presetValue = preset.partialPresetValue;

    if (presetValue == null || (typeof presetValue !== 'function' && objectHasNoKeys(presetValue))) {
      // set and then reset if the value is null or empty
      this.filterSourceDirective.setFilter((presetValue ?? {}) as F);
      this.filterSourceDirective.resetFilter();
    } else {
      const filter = getValueFromGetter(preset.partialPresetValue) as Partial<F>;

      this.filter$.pipe(first()).subscribe((currentFilter) => {
        const nextFilter = { ...currentFilter, ...filterUndefinedValues({ ...currentFilter, ...filter }, true) } as F;
        this.filterSourceDirective.setFilter(nextFilter);
      });
    }
  }

  ngOnDestroy(): void {
    this._partialPresets.complete();
  }
}
