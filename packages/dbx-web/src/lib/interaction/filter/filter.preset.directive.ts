import { shareReplay, map, Observable, combineLatest, distinctUntilChanged, startWith } from 'rxjs';
import { Directive, inject, input, output } from '@angular/core';
import { ClickableFilterPreset, ClickableAnchorLink, FilterSourceDirective, ClickablePartialFilterPreset, ClickableFilterPresetOrPartialPreset, isClickableFilterPreset } from '@dereekb/dbx-core';
import { getValueFromGetter, Maybe, objectHasNoKeys } from '@dereekb/util';
import { FilterWithPreset } from '@dereekb/rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

@Directive()
export abstract class AbstractDbxPresetFilterMenuDirective<F extends FilterWithPreset> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  readonly presetSelected = output<ClickableFilterPresetOrPartialPreset<F>>();
  readonly presets = input<ClickableFilterPresetOrPartialPreset<F>[]>([]);

  readonly presets$ = toObservable(this.presets);

  readonly selected$: Observable<Maybe<F>> = this.filterSourceDirective.filter$.pipe(startWith(undefined), distinctUntilChanged(), shareReplay(1));
  readonly presetsWithPresetStringOnly$: Observable<ClickableFilterPreset<F>[]> = this.presets$.pipe(map((x) => x.filter((y) => Boolean((y as ClickableFilterPreset<F>).preset)) as ClickableFilterPreset<F>[]));

  readonly selectedPresetString$: Observable<Maybe<string>> = this.selected$.pipe(
    map((selectedFilter) => (selectedFilter ? selectedFilter.preset : undefined)),
    distinctUntilChanged()
  );

  readonly presetAnchorsPairs$: Observable<['preset' | 'partialPreset', ClickableFilterPresetOrPartialPreset<F>, ClickableAnchorLink][]> = combineLatest([this.presets$, this.selected$, this.selectedPresetString$]).pipe(
    map(([presets, currentFilterValue, selectedPresetString]) => {
      return presets.map((x) => {
        let selected: boolean;
        let type: 'preset' | 'partialPreset';

        if (isClickableFilterPreset(x)) {
          selected = x.preset === selectedPresetString;
          type = 'preset';
        } else {
          selected = x.isActive(currentFilterValue);
          type = 'partialPreset';
        }

        return [
          type,
          x,
          {
            ...x,
            selected,
            onClick: () => {
              this.selectPreset(x);
            }
          }
        ] as [typeof type, ClickableFilterPresetOrPartialPreset<F>, ClickableAnchorLink];
      });
    }),
    shareReplay(1)
  );

  readonly presetAnchors$: Observable<ClickableAnchorLink[]> = this.presetAnchorsPairs$.pipe(
    map((x) => x.map((x) => x[2])),
    shareReplay(1)
  );

  readonly firstSelectedAnchorPair$ = this.presetAnchorsPairs$.pipe(
    map((presets) => {
      const firstSelected = presets.find((x) => x[2].selected);
      return firstSelected ? firstSelected : undefined;
    }),
    shareReplay(1)
  );

  readonly selectedPreset$: Observable<Maybe<ClickableFilterPreset<F>>> = this.presetAnchorsPairs$.pipe(
    map((presets) => {
      const firstSelected = presets.filter((x) => x[0] === 'preset').find((x) => x[2].selected);
      return firstSelected ? (firstSelected[1] as ClickableFilterPreset<F>) : undefined;
    }),
    shareReplay(1)
  );

  readonly presetAnchorsSignal = toSignal(this.presetAnchors$, { initialValue: [] });
  readonly selectedPresetSignal = toSignal(this.selectedPreset$);

  selectPreset(preset: ClickableFilterPresetOrPartialPreset<F>) {
    const presetString = (preset as ClickableFilterPreset<F>).preset;
    const presetValue = (preset as ClickableFilterPreset<F>).presetValue || (preset as ClickablePartialFilterPreset<F>).partialPresetValue;

    // emit before setting filter, as the view might be destroyed as a result of the filter being set
    this.presetSelected.emit(preset);

    if (presetValue == null || (typeof presetValue !== 'function' && objectHasNoKeys(presetValue))) {
      // set and then reset if the value is null or empty
      this.filterSourceDirective.setFilter((presetValue ?? {}) as F);
      this.filterSourceDirective.resetFilter();
    } else {
      let filter = getValueFromGetter(presetValue) as F;

      if (filter.preset !== presetString) {
        filter = {
          ...filter,
          preset: presetString
        };
      }

      this.filterSourceDirective.setFilter(filter);
    }
  }
}
